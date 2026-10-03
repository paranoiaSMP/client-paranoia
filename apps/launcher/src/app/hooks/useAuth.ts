import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
  listSavedAccounts,
  refreshAccount,
  forgetAccount,
  type Renouvellement,
} from "../../shared/api/authClient";

const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

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


  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const saved = await listSavedAccounts();
        if (cancelled || saved.length === 0) {
          return;
        }

        setAccounts(saved);

        const savedActiveId = localStorage.getItem("paranoia_active_account_id");
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
          localStorage.setItem("paranoia_active_account_id", usable.id);
          setAccounts((prev) =>
            prev.map((a) => (a.id === usable.id ? usable : a)),
          );
          setConnected(true);
        } else if (resultat.etat === "reconnexion") {
          // Microsoft a refuse le jeton: le compte n'existe plus, ici comme
          // cote backend.
          setAccounts((prev) => prev.filter((a) => a.id !== activeTarget.id));
          localStorage.removeItem("paranoia_active_account_id");
        } else {
          // Panne passagere. Le compte reste, et le joueur avec: le
          // renouvellement sera retente au lancement, cote backend, ou au
          // prochain demarrage. Le renvoyer a l'ecran de connexion pour un
          // Xbox Live qui tousse etait exactement le defaut a corriger.
          setAccount(activeTarget);
          setConnected(true);
          console.warn("[auth] session non renouvelee:", resultat.raison);
        }
      } catch {
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
          localStorage.setItem("paranoia_active_account_id", authAccount.id);
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


  async function handleMicrosoftConnect() {
    try {
      setConnectingMicrosoft(true);
      setError(null);
      const { authorizeUrl } = await getMicrosoftAuthorizeUrl(REDIRECT_URI);
      await invoke("open_microsoft_login", { url: authorizeUrl });
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
    localStorage.setItem("paranoia_active_account_id", target.id);

    const resultat = await refreshAccount(target.id);
    if (resultat.etat === "ok") {
      const usable = resultat.compte;
      setAccount(usable);
      localStorage.setItem("paranoia_active_account_id", usable.id);
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
    localStorage.removeItem("paranoia_active_account_id");
    setAccount(null);
    setConnected(false);
    setError(t("topbar.auth_error"));
  }

  async function handleLogout() {
    const current = account;
    const remaining = accounts.filter((a) => a.id !== current?.id);
    setAccounts(remaining);

    const next = remaining[0] ?? null;
    setAccount(next);
    setConnected(next !== null);
    if (next) {
      localStorage.setItem("paranoia_active_account_id", next.id);
    } else {
      localStorage.removeItem("paranoia_active_account_id");
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
    if (account?.id === id) {
      const next = remaining[0] ?? null;
      setAccount(next);
      setConnected(next !== null);
      if (next) {
        localStorage.setItem("paranoia_active_account_id", next.id);
      } else {
        localStorage.removeItem("paranoia_active_account_id");
      }
    }
  }

  return {
    connected,
    account,
    accounts,
    connectingMicrosoft,
    restoringSession,
    devModeAvailable: import.meta.env.DEV,
    handleMicrosoftConnect,
    handleLocalDevContinue,
    handleSwitchAccount,
    handleLogout,
    handleDeleteAccount,
  };
}
