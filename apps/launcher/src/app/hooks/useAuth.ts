import { useState, useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
  comptesEnregistres,
  listSavedAccounts,
  refreshAccount,
  forgetAccount,
  type Renouvellement,
} from "../../shared/api/authClient";
import { choisitCompteActif, compteActif } from "../../shared/api/compteActif";

const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

/** Vrai sur Windows, seul systeme ou la connexion s'ouvre d'elle-meme. */
function surWindows(): boolean {
  return navigator.userAgent.toLowerCase().includes("windows");
}

/**
 * Renouvelle, et laisse au reseau le temps d'arriver.
 *
 * <p>Le launcher demarre souvent avant la connexion: session Windows qui
 * s'ouvre, Wi-Fi qui s'associe, VPN qui se monte. Le premier essai tombe donc
 * dans le trou, et c'est la panne la plus courante -- pas une session perdue.
 * Trois essais sur une dizaine de secondes suffisent a la traverser.
 *
 * <p>On s'arrete des que Microsoft repond que le compte est a refaire:
 * insister n'apporterait rien.
 */
async function renouvelleAvecPatience(
  accountId: string,
  annule: () => boolean,
): Promise<Renouvellement> {
  let dernier: Renouvellement = { etat: "reessayer", raison: "jamais tente" };

  for (let essai = 1; essai <= 3; essai++) {
    dernier = await refreshAccount(accountId);
    if (dernier.etat !== "reessayer" || annule()) {
      return dernier;
    }
    if (essai < 3) {
      await new Promise((resoudre) => setTimeout(resoudre, essai * 2000));
    }
  }

  return dernier;
}

export function useAuth(setError: (err: string | null) => void) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<MicrosoftAccount | null>(null);
  const [accounts, setAccounts] = useState<MicrosoftAccount[]>([]);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  /**
   * Vrai quand le magasin de comptes a reellement repondu.
   *
   * <p>A distinguer d'une liste vide: « le joueur n'a aucun compte » et « on
   * n'a pas pu savoir » menent au meme ecran mais pas aux memes droits. Seul le
   * premier autorise le launcher a ouvrir la fenetre Microsoft de lui-meme.
   */
  const [magasinLu, setMagasinLu] = useState(false);
  /**
   * Vrai apres une deconnexion demandee par le joueur.
   *
   * <p>Sans ce drapeau, se deconnecter du dernier compte sur Windows ramenait
   * l'ecran de connexion, qui rouvrait aussitot la fenetre Microsoft: la
   * deconnexion etait impossible a obtenir.
   */
  const [deconnexionVolontaire, setDeconnexionVolontaire] = useState(false);
  /** Etiquette de la fenetre Microsoft en cours, rendue par Tauri a l'ouverture. */
  const fenetreConnexion = useRef<string | null>(null);
  /** Vrai des que Microsoft a renvoye un code pour la tentative en cours. */
  const codeRecu = useRef(false);


  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const saved = await comptesEnregistres();
        if (cancelled) {
          return;
        }

        // Le magasin a parle: on sait maintenant si le joueur a deja un compte,
        // et l'ecran de connexion peut s'autoriser a ouvrir Microsoft.
        setMagasinLu(true);
        if (saved.length === 0) {
          return;
        }

        setAccounts(saved);

        const savedActiveId = await compteActif();
        const activeTarget = saved.find((a) => a.id === savedActiveId) ?? saved[0];
        if (!activeTarget) {
          return;
        }

        const resultat = await renouvelleAvecPatience(activeTarget.id, () => cancelled);
        if (cancelled) {
          return;
        }

        if (resultat.etat === "ok") {
          const usable = resultat.compte;
          setAccount(usable);
          choisitCompteActif(usable.id);
          setAccounts((prev) =>
            prev.map((a) => (a.id === usable.id ? usable : a)),
          );
          setConnected(true);
        } else if (resultat.etat === "reconnexion") {
          // Microsoft a refuse le jeton: le compte n'existe plus, ici comme
          // cote backend.
          setAccounts((prev) => prev.filter((a) => a.id !== activeTarget.id));
          choisitCompteActif(null);
        } else {
          // Panne passagere. Le compte reste, et le joueur avec: le
          // renouvellement sera retente au lancement, cote backend, ou au
          // prochain demarrage. Le renvoyer a l'ecran de connexion pour un
          // Xbox Live qui tousse etait exactement le defaut a corriger.
          setAccount(activeTarget);
          setConnected(true);
          console.warn("[auth] session non renouvelee:", resultat.raison);
        }
      } catch (err) {
        // Avale en silence, cet echec donnait un launcher qui affirmait que le
        // joueur n'avait pas de compte. Il en a peut-etre un: on ne sait pas.
        console.warn(
          "[auth] comptes enregistres illisibles:",
          err instanceof Error ? err.message : String(err),
        );
      } finally {
        if (!cancelled) {
          setRestoringSession(false);
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    const unlisten = listen<string>("microsoft-oauth-code", async (event) => {
      const url = new URL(event.payload);
      const code = url.searchParams.get("code");
      // Microsoft renvoie le state emis par le backend; il doit repartir tel
      // quel pour que la requete de callback soit reconnue comme la notre.
      const state = url.searchParams.get("state");

      if (code) {
        // Avant tout await: la fermeture de la fenetre suit immediatement, et
        // ne doit pas etre prise pour un abandon.
        codeRecu.current = true;
        try {
          if (!state) {
            throw new Error(t("topbar.auth_error"));
          }

          const authAccount = await completeMicrosoftCallback({
            code,
            state,
            redirectUri: REDIRECT_URI,
          });
          setAccount(authAccount);
          choisitCompteActif(authAccount.id);
          setAccounts((prev) => {
            const normUuid = authAccount.minecraftUuid.replace(/-/g, "").toLowerCase();
            const normUser = authAccount.minecraftUsername.toLowerCase();
            const filtered = prev.filter(
              (a) =>
                a.id !== authAccount.id &&
                a.minecraftUuid.replace(/-/g, "").toLowerCase() !== normUuid &&
                a.minecraftUsername.toLowerCase() !== normUser,
            );
            return [...filtered, authAccount];
          });
          setConnected(true);
          setDeconnexionVolontaire(false);

          // Puis la liste telle que le magasin la connait. C'est `accounts.json`
          // qui fait foi, pas ce que l'interface avait en memoire: quand la
          // liste de depart n'a pas pu etre lue, le compte qui vient d'arriver
          // etait le seul que l'interface montrait, et les autres restaient
          // invisibles -- d'ou un launcher qui semblait n'accepter qu'un compte.
          const tous = await listSavedAccounts().catch(() => null);
          if (tous && tous.length > 0) {
            setAccounts(tous);
            setMagasinLu(true);
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : t("topbar.auth_error"));
        } finally {
          setConnectingMicrosoft(false);
        }
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, [setError, t]);


  /**
   * La fenetre Microsoft a disparu sans qu'un code arrive: la tentative est
   * abandonnee.
   *
   * <p>Rien ne le disait a l'interface. Refermer la fenetre -- celle que
   * l'ecran de connexion ouvrait tout seul au demarrage, le plus souvent --
   * laissait donc le launcher a « Connexion... » pour de bon: le bouton
   * « Ajouter un compte » restait grise, et plus aucun compte ne pouvait
   * s'ajouter jusqu'au redemarrage.
   */
  useEffect(() => {
    const unlisten = listen<string>("microsoft-login-closed", (event) => {
      if (event.payload !== fenetreConnexion.current) {
        // Une fenetre d'une tentative precedente.
        return;
      }
      fenetreConnexion.current = null;
      if (codeRecu.current) {
        // Fermee par le launcher lui-meme, le code en main: la connexion suit
        // son cours et c'est elle qui rendra la main.
        return;
      }
      setConnectingMicrosoft(false);
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);


  async function handleMicrosoftConnect() {
    try {
      setConnectingMicrosoft(true);
      setError(null);
      // La tentative precedente ne compte plus: si sa fenetre est fermee
      // maintenant -- c'est meme ce que fait Tauri avant d'ouvrir la nouvelle
      // -- ce n'est pas celle-ci qui est abandonnee.
      fenetreConnexion.current = null;
      codeRecu.current = false;

      const { authorizeUrl } = await getMicrosoftAuthorizeUrl(REDIRECT_URI);
      fenetreConnexion.current = await invoke<string>("open_microsoft_login", {
        url: authorizeUrl,
      });
    } catch (e) {
      setConnectingMicrosoft(false);
      setError(e instanceof Error ? e.message : t("topbar.auth_launch_error"));
    }
  }


  function handleLocalDevContinue() {
    setConnected(true);
    setAccount({
      id: "local-dev",
      minecraftUuid: "00000000000000000000000000000000",
      minecraftUsername: "DEV",
      skinUrl: "",
      accessToken: "local-dev-token",
      refreshToken: "local-dev-refresh",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
  }


  async function handleSwitchAccount(target: MicrosoftAccount) {
    setAccount(target);
    setConnected(true);
    choisitCompteActif(target.id);

    const resultat = await refreshAccount(target.id);
    if (resultat.etat === "ok") {
      const usable = resultat.compte;
      setAccount(usable);
      choisitCompteActif(usable.id);
      setAccounts((prev) => prev.map((a) => (a.id === usable.id ? usable : a)));
      return;
    }

    if (resultat.etat === "reessayer") {
      // Comme au demarrage: on garde le compte selectionne. Le lancement
      // retentera le renouvellement, et c'est a ce moment-la seulement qu'un
      // echec empeche vraiment de jouer.
      console.warn("[auth] session non renouvelee:", resultat.raison);
      return;
    }

    setAccounts((prev) => prev.filter((a) => a.id !== target.id));
    choisitCompteActif(null);
    setAccount(null);
    setConnected(false);
    setError(t("topbar.auth_error"));
  }

  async function handleLogout() {
    const current = account;
    const remaining = accounts.filter((a) => a.id !== current?.id);
    setAccounts(remaining);
    setDeconnexionVolontaire(true);

    const next = remaining[0] ?? null;
    setAccount(next);
    setConnected(next !== null);
    if (next) {
      choisitCompteActif(next.id);
    } else {
      choisitCompteActif(null);
    }

    if (current && current.id !== "local-dev") {
      await forgetAccount(current.id).catch(() => {});
    }
  }

  async function handleDeleteAccount(id: string) {
    if (id !== "local-dev") {
      await forgetAccount(id).catch(() => {});
    }
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (remaining.length === 0) {
      setDeconnexionVolontaire(true);
    }
    if (account?.id === id) {
      const next = remaining[0] ?? null;
      setAccount(next);
      setConnected(next !== null);
      if (next) {
        choisitCompteActif(next.id);
      } else {
        choisitCompteActif(null);
      }
    }
  }

  return {
    connected,
    account,
    accounts,
    connectingMicrosoft,
    restoringSession,
    /**
     * Le launcher peut-il ouvrir la fenetre Microsoft sans qu'on le lui
     * demande ?
     *
     * <p>Trois conditions, et elles manquaient toutes les trois a l'ecran de
     * connexion, qui se contentait d'une liste vide. Il faut que le magasin ait
     * repondu -- une liste vide par erreur reseau n'est pas une absence de
     * compte --, que le joueur ne vienne pas de se deconnecter, et que ce soit
     * Windows, ou cette ouverture spontanee est le comportement attendu.
     */
    connexionAutomatiqueAutorisee:
      magasinLu &&
      accounts.length === 0 &&
      !deconnexionVolontaire &&
      surWindows(),
    devModeAvailable: import.meta.env.DEV,
    handleMicrosoftConnect,
    handleLocalDevContinue,
    handleSwitchAccount,
    handleLogout,
    handleDeleteAccount,
  };
}
