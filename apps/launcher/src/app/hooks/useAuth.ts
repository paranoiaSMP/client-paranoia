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
} from "../../shared/api/authClient";

const REDIRECT_URI = "https://login.live.com/oauth20_desktop.srf";

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

        const usable = await refreshAccount(activeTarget.id);
        if (cancelled) {
          return;
        }

        if (usable) {
          setAccount(usable);
          localStorage.setItem("paranoia_active_account_id", usable.id);
          setAccounts((prev) =>
            prev.map((a) => (a.id === usable.id ? usable : a)),
          );
          setConnected(true);
        } else {
          setAccounts((prev) => prev.filter((a) => a.id !== activeTarget.id));
          localStorage.removeItem("paranoia_active_account_id");
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
    localStorage.setItem("paranoia_active_account_id", target.id);

    const usable = await refreshAccount(target.id);
    if (usable) {
      setAccount(usable);
      localStorage.setItem("paranoia_active_account_id", usable.id);
      setAccounts((prev) => prev.map((a) => (a.id === usable.id ? usable : a)));
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
