import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
} from "../../shared/api/authClient";

export function useAuth(setError: (err: string | null) => void) {
  const { t } = useTranslation();
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<MicrosoftAccount | null>(null);
  const [accounts, setAccounts] = useState<MicrosoftAccount[]>([]);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);

  /*
   * GESTION DE L'AUTHENTIFICATION MICROSOFT
   * Écoute l'événement Tauri déclenché lors de la redirection OAuth réussie.
   * Procède à l'échange du code contre le Token récupère le profil Minecraft.
   */
  useEffect(() => {
    const unlisten = listen<string>("microsoft-oauth-code", async (event) => {
      const url = new URL(event.payload);
      const code = url.searchParams.get("code");

      if (code) {
        try {
          const authAccount = await completeMicrosoftCallback({
            code,
            state: "tauri",
            redirectUri: "https://login.live.com/oauth20_desktop.srf",
          });
          setAccount(authAccount);
          setAccounts((prev) => {
            if (prev.find((a) => a.id === authAccount.id)) return prev;
            return [...prev, authAccount];
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

  /*
   * LANCEMENT DE LA CONNEXION MICROSOFT
   * Ouvre la fenêtre WebView Tauri pour la page de connexion Microsoft.
   */
  async function handleMicrosoftConnect() {
    try {
      setConnectingMicrosoft(true);
      setError(null);
      const { authorizeUrl } = await getMicrosoftAuthorizeUrl(
        "https://login.live.com/oauth20_desktop.srf",
      );
      await invoke("open_microsoft_login", { url: authorizeUrl });
    } catch (e) {
      setConnectingMicrosoft(false);
      setError(e instanceof Error ? e.message : t("topbar.auth_launch_error"));
    }
  }

  /*
   * COMPTE DE DEVELOPPEMENT LOCAL
   * Permet de contourner l'authentification Microsoft en environnement de développement.
   */
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

  /*
   * GESTION DES COMPTES ACTIFS
   */
  function handleSwitchAccount(target: MicrosoftAccount) {
    setAccount(target);
  }

  function handleLogout() {
    setAccounts((prev) => prev.filter((a) => a.id !== account?.id));
    const remaining = accounts.filter((a) => a.id !== account?.id);
    if (remaining.length > 0) {
      setAccount(remaining[0]);
    } else {
      setAccount(null);
      setConnected(false);
    }
  }

  return {
    connected,
    account,
    accounts,
    connectingMicrosoft,
    handleMicrosoftConnect,
    handleLocalDevContinue,
    handleSwitchAccount,
    handleLogout,
  };
}
