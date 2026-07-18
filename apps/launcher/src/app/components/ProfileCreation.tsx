import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RemoteConfiguration } from "@paranoia/contracts";

type ProfileCreationProps = {
  step: number;
  setStep: (step: number) => void;
  connected: boolean;
  error: string | null;
  profileName: string;
  setProfileName: (name: string) => void;
  minecraftVersion: string;
  setMinecraftVersion: (v: string) => void;
  config: RemoteConfiguration | null;
  importSettings: boolean;
  setImportSettings: (v: boolean) => void;
  keybindSource: string;
  setKeybindSource: (v: string) => void;
  detectedProfiles: any[];
  importOptions: any;
  setImportOptions: (o: any) => void;
  profileType: string;
  setProfileType: (t: string) => void;
  graphicsMode: string;
  setGraphicsMode: (g: string) => void;
  selectedType: any;
  selectedGraphics: any;
  handleInstall: () => void;
  installState: string;
};

export function ProfileCreation({
  step,
  setStep,
  connected,
  error,
  profileName,
  setProfileName,
  minecraftVersion,
  setMinecraftVersion,
  config,
  importSettings,
  setImportSettings,
  keybindSource,
  setKeybindSource,
  detectedProfiles,
  importOptions,
  setImportOptions,
  profileType,
  setProfileType,
  graphicsMode,
  setGraphicsMode,
  selectedType,
  selectedGraphics,
  handleInstall,
  installState,
}: ProfileCreationProps) {
  const { t } = useTranslation();

  /*
   * ASSISTANT DE CREATION DE PROFIL (WIZARD)
   * Guide l'utilisateur a travers 5 etapes pour configurer un nouveau profil Minecraft.
   * Les etapes incluent la verification du compte, le choix de version/nom, le preset global,
   * le preset graphique et enfin un recapitulatif avant l'installation.
   */
  return (
    <div className="bg-[#1c1c1e] border-2 border-[#2a2a2c] rounded-xl p-8 max-w-2xl mx-auto shadow-2xl">
      <h3 className="text-2xl font-black text-white mb-6">
        {t("wizard.title")}
      </h3>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex-1 h-3 rounded-sm transition-all ${step >= s ? "bg-accent-purple shadow-[0_0_10px_rgba(157,13,242,0.5)]" : "bg-[#2a2a2c]"}`}
          ></div>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border-2 border-red-500 rounded text-red-200 font-bold mb-6">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h4 className="text-lg font-bold text-white">{t("wizard.step1")}</h4>
          <p className="text-[#8888a0]">{t("wizard.step1_desc")}</p>
          {connected ? (
            <div className="p-4 bg-[#1e6b33] border-2 border-[#34a853] rounded text-white font-bold flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" strokeWidth={3} />
              {t("wizard.step1_success")}
            </div>
          ) : (
            <p className="text-accent-red font-bold">
              {t("wizard.step1_error")}
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-white">{t("wizard.step2")}</h4>
          <div>
            <label className="block text-sm font-bold text-[#8888a0] mb-2">
              {t("wizard.name_label")}
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full bg-[#0d0d0f] border-2 border-[#2a2a2c] rounded px-4 py-3 text-white font-bold focus:outline-none focus:border-accent-purple transition-colors"
              placeholder={t("wizard.name_placeholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#8888a0] mb-2">
              {t("wizard.version_label")}
            </label>
            <select
              value={minecraftVersion}
              onChange={(e) => setMinecraftVersion(e.target.value)}
              className="w-full bg-[#0d0d0f] border-2 border-[#2a2a2c] rounded px-4 py-3 text-white font-bold focus:outline-none focus:border-accent-purple transition-colors appearance-none"
            >
              {config?.supportedMinecraftVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${importSettings ? "bg-accent-purple border-accent-purple" : "bg-[#0d0d0f] border-[#2a2a2c] group-hover:border-[#4a4a4c]"}`}
              >
                {importSettings && (
                  <CheckCircle2
                    className="w-4 h-4 text-white"
                    strokeWidth={3}
                  />
                )}
              </div>
              <input
                type="checkbox"
                className="hidden"
                checked={importSettings}
                onChange={(e) => setImportSettings(e.target.checked)}
              />
              <div>
                <span className="font-bold text-white block">
                  {t("wizard.import_settings")}
                </span>
                <span className="text-xs text-[#8888a0]">
                  {t("wizard.import_settings_desc")}
                </span>
              </div>
            </label>

            {importSettings && (
              <div className="mt-4 pl-9 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs font-bold text-[#8888a0] mb-2 uppercase tracking-wider">
                    {t("wizard.which_profile")}
                  </label>
                  <select
                    value={keybindSource}
                    onChange={(e) => setKeybindSource(e.target.value)}
                    className="w-full bg-[#111111] border border-[#2a2a2c] rounded px-4 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-accent-purple transition-colors appearance-none cursor-pointer"
                  >
                    <option value="auto">{t("wizard.auto")}</option>
                    <optgroup label={t("wizard.detected")}>
                      {detectedProfiles.length === 0 && (
                        <option disabled>{t("wizard.searching")}</option>
                      )}
                      {detectedProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-3 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${importOptions.keybinds ? "bg-accent-purple border-accent-purple" : "bg-[#0d0d0f] border-[#2a2a2c] group-hover:border-[#4a4a4c]"}`}
                    >
                      {importOptions.keybinds && (
                        <CheckCircle2
                          className="w-3 h-3 text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={importOptions.keybinds}
                      onChange={(e) =>
                        setImportOptions({
                          ...importOptions,
                          keybinds: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-bold text-white">
                      {t("wizard.keybinds")}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${importOptions.sensitivity ? "bg-accent-purple border-accent-purple" : "bg-[#0d0d0f] border-[#2a2a2c] group-hover:border-[#4a4a4c]"}`}
                    >
                      {importOptions.sensitivity && (
                        <CheckCircle2
                          className="w-3 h-3 text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={importOptions.sensitivity}
                      onChange={(e) =>
                        setImportOptions({
                          ...importOptions,
                          sensitivity: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-bold text-white">
                      {t("wizard.sensitivity")}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${importOptions.graphics ? "bg-accent-purple border-accent-purple" : "bg-[#0d0d0f] border-[#2a2a2c] group-hover:border-[#4a4a4c]"}`}
                    >
                      {importOptions.graphics && (
                        <CheckCircle2
                          className="w-3 h-3 text-white"
                          strokeWidth={3}
                        />
                      )}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={importOptions.graphics}
                      onChange={(e) =>
                        setImportOptions({
                          ...importOptions,
                          graphics: e.target.checked,
                        })
                      }
                    />
                    <span className="text-sm font-bold text-white">
                      {t("wizard.graphics")}
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-white">{t("wizard.step3")}</h4>
          <div className="grid gap-3">
            {config?.profileTypes.map((t) => (
              <div
                key={t.id}
                onClick={() => setProfileType(t.id)}
                className={`p-4 rounded border-2 cursor-pointer transition-all ${profileType === t.id ? "bg-accent-purple/20 border-accent-purple" : "bg-[#0d0d0f] border-[#2a2a2c] hover:border-[#4a4a4c]"}`}
              >
                <div className="font-black text-white">{t.label}</div>
                <div className="text-sm font-medium text-[#8888a0]">
                  {t.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-white">{t("wizard.step4")}</h4>
          <div className="grid gap-3">
            {config?.graphicsModes.map((g) => (
              <div
                key={g.id}
                onClick={() => setGraphicsMode(g.id)}
                className={`p-4 rounded border-2 cursor-pointer transition-all ${graphicsMode === g.id ? "bg-accent-purple/20 border-accent-purple" : "bg-[#0d0d0f] border-[#2a2a2c] hover:border-[#4a4a4c]"}`}
              >
                <div className="font-black text-white">{g.label}</div>
                <div className="text-sm font-medium text-[#8888a0]">
                  {g.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-white">{t("wizard.step5")}</h4>
          <div className="p-6 bg-[#0d0d0f] rounded border-2 border-[#2a2a2c] space-y-3 font-medium">
            <div className="flex justify-between border-b border-[#2a2a2c] pb-3">
              <span className="text-[#8888a0]">{t("wizard.version")}</span>
              <span className="font-black text-white">{minecraftVersion}</span>
            </div>
            <div className="flex justify-between border-b border-[#2a2a2c] py-3">
              <span className="text-[#8888a0]">{t("wizard.type")}</span>
              <span className="font-black text-accent-purple">
                {selectedType?.label}
              </span>
            </div>
            <div className="flex justify-between pt-3">
              <span className="text-[#8888a0]">
                {t("wizard.graphics_label")}
              </span>
              <span className="font-black text-white">
                {selectedGraphics?.label}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8 pt-6 border-t border-[#2a2a2c]">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className="px-6 py-2 rounded text-[#8888a0] font-bold hover:text-white hover:bg-[#2a2a2c] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t("wizard.back")}
        </button>

        {step < 5 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={step === 1 && !connected}
            className="px-8 py-2 bg-white text-black font-black rounded hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_rgba(157,13,242,0.5)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {t("wizard.next")}
          </button>
        ) : (
          <button
            onClick={handleInstall}
            disabled={installState === "running"}
            className="px-8 py-2 bg-accent-red text-white font-black rounded hover:bg-red-500 transition-all disabled:opacity-50 shadow-[4px_4px_0px_rgba(255,77,77,0.4)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {installState === "running"
              ? t("wizard.preparing")
              : t("wizard.forge")}
          </button>
        )}
      </div>
    </div>
  );
}
