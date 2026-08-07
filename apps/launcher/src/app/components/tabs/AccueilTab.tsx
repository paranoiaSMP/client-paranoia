import { Play, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  LauncherProfile,
  MicrosoftAccount,
  NewsItem,
} from "@paranoia/contracts";
import type { LaunchStatusResponse } from "../../../shared/api/launcherClient";

type AccueilTabProps = {
  account: MicrosoftAccount | null;
  profiles: LauncherProfile[];
  connected: boolean;
  installState: string;
  launchStatus?: LaunchStatusResponse;
  selectedProfileId: string | null;
  news: NewsItem[];
  setSelectedProfileId: (id: string) => void;
  setActiveTab: (tab: "accueil" | "profils" | "parametres") => void;
  onLaunchGame: (id: string) => void;
};

export function AccueilTab({
  account,
  profiles,
  connected,
  installState,
  launchStatus,
  selectedProfileId,
  news,
  setSelectedProfileId,
  setActiveTab,
  onLaunchGame,
}: AccueilTabProps) {
  const { t } = useTranslation();
  const mainProfile = profiles.find((p) => p.id === selectedProfileId) || (profiles.length > 0 ? profiles[0] : null);

  /*
   * VUE D'ACCUEIL DU LAUNCHER
   * Affiche la banniere principale avec le bouton de lancement du jeu.
   * Permet egalement de basculer rapidement entre les profils recents et de consulter les dernieres actualites.
   */
  return (
    <div className="w-full animate-in fade-in duration-400 flex flex-col gap-5 pt-2">
      <p className="text-[#a1a1aa] text-sm">
        {t("home.welcome")}{" "}
        <span className="text-white font-bold">
          {account?.minecraftUsername || t("home.guest")}
        </span>
      </p>

      <div className="relative w-full h-[280px] rounded-xl overflow-hidden border border-[#27272a] bg-[#09090b]">
        <img
          src="/hero-bg.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          style={{ objectPosition: "center 65%" }}
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {mainProfile ? (
            <>
              <button
                onClick={() => {
                  setSelectedProfileId(mainProfile.id);
                  onLaunchGame(mainProfile.id);
                }}
                disabled={!connected || installState === "running"}
                className="bg-accent-purple hover:bg-accent-purple-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-3.5 rounded-lg text-lg font-bold flex items-center gap-2 transition-colors relative overflow-hidden"
              >
                {installState === "running" && launchStatus && (
                  <div
                    className="absolute inset-0 bg-white/20 transition-all duration-300"
                    style={{ width: `${launchStatus.progress}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <Play className="w-5 h-5 fill-current" />
                  {installState === "running"
                    ? t("home.launching")
                    : t("home.play")}
                </span>
              </button>

              <div className="flex flex-col items-center gap-1">
                <p className="text-[#a1a1aa] text-xs">
                  {mainProfile.name} {mainProfile.minecraftVersion} &middot;{" "}
                  {mainProfile.profileTypeId}
                </p>
                {installState === "running" && launchStatus && (
                  <p className="text-white/80 font-mono text-xs bg-black/40 px-3 py-1 rounded-full animate-pulse">
                    {launchStatus.text}{" "}
                    {launchStatus.progress > 0 && `${launchStatus.progress}%`}
                  </p>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => setActiveTab("profils")}
              className="bg-white text-black px-8 py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors"
            >
              {t("home.create_profile")}
            </button>
          )}
        </div>

        <button
          onClick={() => setActiveTab("parametres")}
          className="absolute bottom-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-[#71717a] hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {profiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {profiles.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelectedProfileId(p.id)}
              className={`w-12 h-12 shrink-0 rounded-lg flex items-center justify-center cursor-pointer transition-colors text-xs font-bold ${
                p.id === mainProfile?.id
                  ? "bg-accent-purple/20 border border-accent-purple text-accent-purple"
                  : "bg-[#18181b] border border-[#27272a] text-[#71717a] hover:border-[#3f3f46] hover:text-white"
              }`}
              title={p.name}
            >
              {p.minecraftVersion.split(".").slice(-1)[0]}
            </div>
          ))}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-bold text-sm">
            {t("home.discover")}{" "}
            {news.length > 0 && (
              <span className="text-[#71717a] font-normal">
                ({news.length})
              </span>
            )}
          </h2>
        </div>

        {news.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {news.map((item, idx) => (
              <div
                key={idx}
                className="min-w-[300px] h-[160px] bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden relative cursor-pointer hover:border-[#3f3f46] transition-colors group"
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-white font-bold text-sm">{item.title}</p>
                  <p className="text-[#71717a] text-xs mt-1 line-clamp-2">
                    {item.excerpt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 text-center">
            <p className="text-[#52525b] text-sm">
              Pas de news pour le moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
