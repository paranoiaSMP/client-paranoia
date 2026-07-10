import { useEffect, useMemo, useState } from "react";
import type {
  GraphicsModeDefinition,
  LauncherProfile,
  MicrosoftAccount,
  NewsItem,
  ProfileTypeDefinition,
  RemoteConfiguration,
  ServerStatus
} from "@paranoia/contracts";
import { createInstallationManifest, fetchRemoteConfiguration } from "../shared/api/catalogClient";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  exportProfile,
  favoriteProfile,
  importProfile,
  listProfiles,
  updateProfile
} from "../shared/api/profilesClient";
import { completeMicrosoftCallback, getMicrosoftAuthorizeUrl } from "../shared/api/authClient";
import { fetchNews, fetchServerStatus } from "../shared/api/launcherInfoClient";

type SetupStep = 1 | 2 | 3 | 4 | 5;

export function App() {
  const [step, setStep] = useState<SetupStep>(1);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<RemoteConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minecraftVersion, setMinecraftVersion] = useState("1.21.11");
  const [profileType, setProfileType] = useState<string>("pvp");
  const [graphicsMode, setGraphicsMode] = useState<string>("performance");
  const [profileName, setProfileName] = useState("Mon profil");
  const [setupComplete, setSetupComplete] = useState(false);
  const [profiles, setProfiles] = useState<LauncherProfile[]>([]);
  const [installState, setInstallState] = useState<"idle" | "running" | "done">("idle");
  const [account, setAccount] = useState<MicrosoftAccount | null>(null);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [importJson, setImportJson] = useState("");

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const [remoteConfig, existingProfiles] = await Promise.all([
          fetchRemoteConfiguration(),
          listProfiles()
        ]);

        const [latestNews, status] = await Promise.all([fetchNews(), fetchServerStatus()]);

        setConfig(remoteConfig);
        const defaultMinecraftVersion = remoteConfig.supportedMinecraftVersions[0];
        if (defaultMinecraftVersion) {
          setMinecraftVersion(defaultMinecraftVersion);
        }

        const defaultProfileType = remoteConfig.profileTypes[0];
        if (defaultProfileType) {
          setProfileType(defaultProfileType.id);
        }

        const defaultGraphicsMode = remoteConfig.graphicsModes[0];
        if (defaultGraphicsMode) {
          setGraphicsMode(defaultGraphicsMode.id);
        }

        setProfiles(existingProfiles);
        setSetupComplete(existingProfiles.length > 0);
        setNews(latestNews);
        setServerStatus(status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown bootstrap error");
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  useEffect(() => {
    async function tryHandleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (!code || !state) {
        return;
      }

      try {
        setConnectingMicrosoft(true);
        setError(null);
        const redirectUri = `${window.location.origin}/auth/callback`;
        const authAccount = await completeMicrosoftCallback({ code, state, redirectUri });
        setAccount(authAccount);
        setConnected(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Microsoft callback failed");
      } finally {
        setConnectingMicrosoft(false);
      }
    }

    tryHandleAuthCallback();
  }, []);

  async function handleMicrosoftConnect() {
    try {
      setConnectingMicrosoft(true);
      setError(null);
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { authorizeUrl } = await getMicrosoftAuthorizeUrl(redirectUri);
      window.location.assign(authorizeUrl);
    } catch (e) {
      setConnectingMicrosoft(false);
      setError(e instanceof Error ? e.message : "Unable to start Microsoft auth");
    }
  }

  function handleLocalDevContinue() {
    setConnected(true);
    setAccount({
      id: "local-dev",
      minecraftUuid: "00000000000000000000000000000000",
      minecraftUsername: "LocalDev",
      skinUrl: "",
      accessToken: "local-dev-token",
      refreshToken: "local-dev-refresh",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }

  const selectedType = useMemo(
    () => config?.profileTypes.find((x) => x.id === profileType),
    [config, profileType]
  );
  const selectedGraphics = useMemo(
    () => config?.graphicsModes.find((x) => x.id === graphicsMode),
    [config, graphicsMode]
  );

  async function handleInstall() {
    try {
      setInstallState("running");
      setError(null);

      await createInstallationManifest({
        minecraftVersion,
        profileTypeId: profileType,
        graphicsModeId: graphicsMode,
        locale: "fr-FR"
      });

      await createProfile({
        name: profileName,
        minecraftVersion,
        profileTypeId: profileType,
        graphicsModeId: graphicsMode,
        ramMb: 4096,
        resolution: "1920x1080"
      });

      const refreshedProfiles = await listProfiles();
      setProfiles(refreshedProfiles);
      setSetupComplete(true);
      setInstallState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown install error");
      setInstallState("idle");
    }
  }

  async function handleDeleteProfile(profileId: string) {
    await deleteProfile(profileId);
    setProfiles(await listProfiles());
  }

  async function handleDuplicateProfile(profileId: string) {
    await duplicateProfile(profileId);
    setProfiles(await listProfiles());
  }

  async function handleFavoriteProfile(profileId: string) {
    await favoriteProfile(profileId);
    setProfiles(await listProfiles());
  }

  async function handleRenameProfile(profile: LauncherProfile) {
    const nextName = window.prompt("Nouveau nom du profil", profile.name)?.trim();
    if (!nextName || nextName === profile.name) {
      return;
    }

    await updateProfile(profile.id, { name: nextName });
    setProfiles(await listProfiles());
  }

  async function handleExportProfile(profileId: string) {
    const data = await exportProfile(profileId);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${data.name.replace(/\s+/g, "-").toLowerCase()}-profile.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportProfile() {
    const parsed = JSON.parse(importJson) as Partial<LauncherProfile>;
    if (
      !parsed.name ||
      !parsed.minecraftVersion ||
      !parsed.profileTypeId ||
      !parsed.graphicsModeId ||
      !parsed.ramMb ||
      !parsed.resolution
    ) {
      throw new Error("JSON import invalide: champs requis manquants");
    }

    await importProfile({
      name: parsed.name,
      minecraftVersion: parsed.minecraftVersion,
      profileTypeId: parsed.profileTypeId,
      graphicsModeId: parsed.graphicsModeId,
      ramMb: parsed.ramMb,
      resolution: parsed.resolution
    });

    setImportJson("");
    setProfiles(await listProfiles());
  }

  if (loading) {
    return <div className="app-shell">Chargement de la configuration distante...</div>;
  }

  if (!config) {
    return <div className="app-shell">Impossible de charger le launcher.</div>;
  }

  if (setupComplete) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <h1>Paranoia Client</h1>
          <p>Gestion des profils</p>
        </header>

        <main className="glass-card">
          <div className="dashboard-row">
            <section className="dashboard-tile">
              <h3>Statut serveur</h3>
              {serverStatus ? (
                <>
                  <p>
                    {serverStatus.online ? "En ligne" : "Hors ligne"} • {serverStatus.pingMs} ms
                  </p>
                  <p>
                    Joueurs: {serverStatus.playerCount}/{serverStatus.maxPlayers}
                  </p>
                </>
              ) : (
                <p>Indisponible</p>
              )}
            </section>

            <section className="dashboard-tile">
              <h3>Actualites</h3>
              {news.length === 0 && <p>Aucune actualite.</p>}
              {news.slice(0, 2).map((item) => (
                <article key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.excerpt}</p>
                </article>
              ))}
            </section>
          </div>

          <h2>Profils installes</h2>
          {profiles.length === 0 && <p>Aucun profil pour le moment.</p>}
          <section className="import-box">
            <h3>Importer un profil (JSON)</h3>
            <textarea
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder='{"name":"PvP", "minecraftVersion":"1.21.11", ...}'
            />
            <button
              onClick={async () => {
                try {
                  await handleImportProfile();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Import profile failed");
                }
              }}
            >
              Importer
            </button>
          </section>

          <div className="profile-grid">
            {profiles.map((profile) => (
              <article className="profile-card" key={profile.id}>
                <h3>{profile.name}</h3>
                <p>
                  {profile.minecraftVersion} • {profile.profileTypeId} • {profile.graphicsModeId}
                </p>
                <p>
                  RAM: {profile.ramMb} MB • Resolution: {profile.resolution}
                </p>
                {profile.favorite && <div className="badge">Favori</div>}
                <div className="row-actions">
                  <button onClick={() => handleFavoriteProfile(profile.id)}>Favori</button>
                  <button onClick={() => handleRenameProfile(profile)}>Renommer</button>
                  <button onClick={() => handleDuplicateProfile(profile.id)}>Dupliquer</button>
                  <button onClick={() => handleExportProfile(profile.id)}>Exporter</button>
                  <button className="danger" onClick={() => handleDeleteProfile(profile.id)}>
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>

          <footer className="wizard-footer">
            <button
              className="primary"
              onClick={() => {
                setSetupComplete(false);
                setStep(1);
              }}
            >
              Creer un nouveau profil
            </button>
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>Paranoia Client</h1>
        <p>First Setup</p>
      </header>

      <main className="glass-card">
        <StepIndicator step={step} />
        {error && <div className="state-error">{error}</div>}

        {step === 1 && (
          <section>
            <h2>Connexion Microsoft</h2>
            <p>La connexion Microsoft est obligatoire avant utilisation du launcher.</p>
            <button className="primary" onClick={handleMicrosoftConnect} disabled={connectingMicrosoft}>
              {connectingMicrosoft ? "Connexion en cours..." : "Connecter le compte Microsoft"}
            </button>
            <button className="ghost" onClick={handleLocalDevContinue}>
              Continuer en mode local (dev)
            </button>
            {connected && (
              <div className="state-ok">
                Connecte: {account?.minecraftUsername ?? "profil"} ({account?.minecraftUuid ?? "uuid"})
              </div>
            )}
          </section>
        )}

        {step === 2 && (
          <section>
            <h2>Version Minecraft</h2>
            <label className="field-label" htmlFor="profile-name">
              Nom du profil
            </label>
            <input
              id="profile-name"
              className="text-input"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Ex: PvP Ranked"
            />
            <select value={minecraftVersion} onChange={(e) => setMinecraftVersion(e.target.value)}>
              {config.supportedMinecraftVersions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </section>
        )}

        {step === 3 && (
          <section>
            <h2>Type de profil</h2>
            <p>Les packs installes proviennent uniquement de la config distante.</p>
            <OptionCards
              value={profileType}
              options={config.profileTypes}
              onSelect={setProfileType}
            />
          </section>
        )}

        {step === 4 && (
          <section>
            <h2>Mode graphique</h2>
            <p>Le launcher applique la configuration distante choisie.</p>
            <OptionCards
              value={graphicsMode}
              options={config.graphicsModes}
              onSelect={setGraphicsMode}
            />
          </section>
        )}

        {step === 5 && (
          <section>
            <h2>Recapitulatif d installation</h2>
            <ul>
              <li>Version: {minecraftVersion}</li>
              <li>Type: {selectedType?.label ?? "-"}</li>
              <li>Graphique: {selectedGraphics?.label ?? "-"}</li>
              <li>Assets: Minecraft, Fabric, Java si necessaire, mods, shaders, packs, configs</li>
            </ul>
            <button
              className="primary"
              onClick={handleInstall}
              disabled={installState === "running" || profileName.trim().length === 0}
            >
              {installState === "running" ? "Installation en cours..." : "Installer maintenant"}
            </button>
          </section>
        )}

        <footer className="wizard-footer">
          <button disabled={step === 1} onClick={() => setStep((step - 1) as SetupStep)}>
            Retour
          </button>
          <button
            className="primary"
            disabled={(step === 1 && !connected) || step === 5}
            onClick={() => setStep((step + 1) as SetupStep)}
          >
            Suivant
          </button>
        </footer>
      </main>
    </div>
  );
}

function StepIndicator({ step }: { step: SetupStep }) {
  const labels = ["Connexion", "Version", "Type", "Graphique", "Installation"];

  return (
    <div className="steps">
      {labels.map((label, index) => {
        const current = index + 1;
        const active = current === step;
        const done = current < step;
        return (
          <div key={label} className={`step ${active ? "active" : ""} ${done ? "done" : ""}`}>
            <span>{current}</span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function OptionCards({
  value,
  options,
  onSelect
}: {
  value: string;
  options: Array<ProfileTypeDefinition | GraphicsModeDefinition>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="option-grid">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          className={`option-card ${value === option.id ? "selected" : ""}`}
        >
          <h3>{option.label}</h3>
          <p>{option.description}</p>
        </button>
      ))}
    </div>
  );
}
