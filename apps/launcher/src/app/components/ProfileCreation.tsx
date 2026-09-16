import type { Dispatch, SetStateAction } from "react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  GraphicsModeDefinition,
  ProfileTypeDefinition,
  RemoteConfiguration,
} from "@paranoia/contracts";

/** Les cinq ecrans de l'assistant, dans l'ordre. */
export type SetupStep = 1 | 2 | 3 | 4 | 5;

/**
 * Un profil trouve dans un autre launcher installe sur la machine.
 *
 * <p>Les champs sont ceux de la structure Rust {@code DetectedProfile}, seule
 * source de verite: c'est elle qui remplit la reponse de la commande Tauri
 * {@code get_detected_profiles}. Le type declarait auparavant {@code name} la
 * ou Rust envoie {@code label}; personne ne s'en apercevait parce que la liste
 * etait passee en {@code any[]}.
 */
export type DetectedProfile = {
  id: string;
  label: string;
  options_path: string;
  launcher: string;
};

/** Ce que l'on reprend d'un profil existant. */
export type ImportOptions = {
  keybinds: boolean;
  sensitivity: boolean;
  graphics: boolean;
};

/**
 * Les deux deplacements dans l'assistant, bornes aux ecrans qui existent.
 *
 * <p>Les boutons calculaient {@code step - 1} et {@code step + 1}, ce qui rend
 * un {@code number} quelconque. Les bornes etaient tenues ailleurs -- par
 * l'attribut {@code disabled} du premier bouton et par la condition
 * {@code step < 5} du second -- donc a distance de l'endroit ou le calcul se
 * fait. Les mettre ici les rend verifiables.
 */
const stepBefore = (step: SetupStep): SetupStep =>
  step === 1 ? 1 : ((step - 1) as SetupStep);

const stepAfter = (step: SetupStep): SetupStep =>
  step === 5 ? 5 : ((step + 1) as SetupStep);

/*
 * Sept proprietes etaient en `any`, dont les deux definitions choisies et la
 * liste des profils detectes -- alors que leurs types existent, l'un dans les
 * contrats partages, l'autre a deux fichiers de la. Le cout se voyait chez
 * l'appelant: App.tsx devait ecrire `setStep as any` pour faire passer son
 * SetupStep dans un parametre declare `number`.
 */
type ProfileCreationProps = {
  step: SetupStep;
  setStep: Dispatch<SetStateAction<SetupStep>>;
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
  detectedProfiles: DetectedProfile[];
  importOptions: ImportOptions;
  setImportOptions: Dispatch<SetStateAction<ImportOptions>>;
  profileType: string;
  setProfileType: (t: string) => void;
  graphicsMode: string;
  setGraphicsMode: (g: string) => void;
  selectedType: ProfileTypeDefinition | undefined;
  selectedGraphics: GraphicsModeDefinition | undefined;
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
  return (
    <div className="bg-surface border-2 border-divider rounded-xl p-8 max-w-2xl mx-auto shadow-2xl">
      <h3 className="text-2xl font-black text-ink mb-6">
        {t("wizard.title")}
      </h3>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex-1 h-3 rounded-sm transition-all ${step >= s ? "bg-accent shadow-[0_0_10px_rgba(157,13,242,0.5)]" : "bg-divider"}`}
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
          <h4 className="text-lg font-bold text-ink">{t("wizard.step1")}</h4>
          <p className="text-neutral-400">{t("wizard.step1_desc")}</p>
          {connected ? (
            <div className="p-4 bg-[#1e6b33] border-2 border-[#34a853] rounded text-ink font-bold flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6" strokeWidth={3} />
              {t("wizard.step1_success")}
            </div>
          ) : (
            <p className="text-danger font-bold">
              {t("wizard.step1_error")}
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-ink">{t("wizard.step2")}</h4>
          <div>
            <label className="block text-sm font-bold text-neutral-400 mb-2">
              {t("wizard.name_label")}
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="w-full bg-ground border-2 border-divider rounded px-4 py-3 text-ink font-bold focus:outline-none focus:border-accent transition-colors"
              placeholder={t("wizard.name_placeholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-neutral-400 mb-2">
              {t("wizard.version_label")}
            </label>
            <select
              value={minecraftVersion}
              onChange={(e) => setMinecraftVersion(e.target.value)}
              className="w-full bg-ground border-2 border-divider rounded px-4 py-3 text-ink font-bold focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              {config?.supportedMinecraftVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                  {config.clientModVersions?.includes(v) ? "  — Client Paranoia" : ""}
                </option>
              ))}
            </select>

            {/* Le launcher propose toutes les versions publiees par Mojang,
                mais le mod n'est compile que pour quelques-unes. Sans cet
                avertissement, l'instance se lance sans le client et rien ne
                dit pourquoi. */}
            {config?.clientModVersions && config.clientModVersions.length > 0
              && !config.clientModVersions.includes(minecraftVersion) && (
              <p className="mt-2 text-xs text-amber-400/90">
                Le client Paranoia n'existe pas pour cette version. L'instance
                se lancera en Minecraft normal. Versions couvertes :{" "}
                {config.clientModVersions.join(", ")}.
              </p>
            )}
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${importSettings ? "bg-accent border-accent" : "bg-ground border-divider group-hover:border-neutral-600"}`}
              >
                {importSettings && (
                  <CheckCircle2
                    className="w-4 h-4 text-ink"
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
                <span className="font-bold text-ink block">
                  {t("wizard.import_settings")}
                </span>
                <span className="text-xs text-neutral-400">
                  {t("wizard.import_settings_desc")}
                </span>
              </div>
            </label>

            {importSettings && (
              <div className="mt-4 pl-9 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                    {t("wizard.which_profile")}
                  </label>
                  <select
                    value={keybindSource}
                    onChange={(e) => setKeybindSource(e.target.value)}
                    className="w-full bg-ground border border-divider rounded px-4 py-2.5 text-ink font-bold text-sm focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
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
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${importOptions.keybinds ? "bg-accent border-accent" : "bg-ground border-divider group-hover:border-neutral-600"}`}
                    >
                      {importOptions.keybinds && (
                        <CheckCircle2
                          className="w-3 h-3 text-ink"
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
                    <span className="text-sm font-bold text-ink">
                      {t("wizard.keybinds")}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${importOptions.sensitivity ? "bg-accent border-accent" : "bg-ground border-divider group-hover:border-neutral-600"}`}
                    >
                      {importOptions.sensitivity && (
                        <CheckCircle2
                          className="w-3 h-3 text-ink"
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
                    <span className="text-sm font-bold text-ink">
                      {t("wizard.sensitivity")}
                    </span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${importOptions.graphics ? "bg-accent border-accent" : "bg-ground border-divider group-hover:border-neutral-600"}`}
                    >
                      {importOptions.graphics && (
                        <CheckCircle2
                          className="w-3 h-3 text-ink"
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
                    <span className="text-sm font-bold text-ink">
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
          <h4 className="text-lg font-bold text-ink">{t("wizard.step3")}</h4>
          <div className="grid gap-3">
            {config?.profileTypes.map((t) => (
              <div
                key={t.id}
                onClick={() => setProfileType(t.id)}
                className={`p-4 rounded border-2 cursor-pointer transition-all ${profileType === t.id ? "bg-accent/20 border-accent" : "bg-ground border-divider hover:border-neutral-600"}`}
              >
                <div className="font-black text-ink">{t.label}</div>
                <div className="text-sm font-medium text-neutral-400">
                  {t.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-ink">{t("wizard.step4")}</h4>
          <div className="grid gap-3">
            {config?.graphicsModes.map((g) => (
              <div
                key={g.id}
                onClick={() => setGraphicsMode(g.id)}
                className={`p-4 rounded border-2 cursor-pointer transition-all ${graphicsMode === g.id ? "bg-accent/20 border-accent" : "bg-ground border-divider hover:border-neutral-600"}`}
              >
                <div className="font-black text-ink">{g.label}</div>
                <div className="text-sm font-medium text-neutral-400">
                  {g.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <h4 className="text-lg font-bold text-ink">{t("wizard.step5")}</h4>
          <div className="p-6 bg-ground rounded border-2 border-divider space-y-3 font-medium">
            <div className="flex justify-between border-b border-divider pb-3">
              <span className="text-neutral-400">{t("wizard.version")}</span>
              <span className="font-black text-ink">{minecraftVersion}</span>
            </div>
            <div className="flex justify-between border-b border-divider py-3">
              <span className="text-neutral-400">{t("wizard.type")}</span>
              <span className="font-black text-accent">
                {selectedType?.label}
              </span>
            </div>
            <div className="flex justify-between pt-3">
              <span className="text-neutral-400">
                {t("wizard.graphics_label")}
              </span>
              <span className="font-black text-ink">
                {selectedGraphics?.label}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-8 pt-6 border-t border-divider">
        <button
          onClick={() => setStep(stepBefore(step))}
          disabled={step === 1 || (step === 2 && connected)}
          className="px-6 py-2 rounded text-neutral-400 font-bold hover:text-ink hover:bg-divider transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t("wizard.back")}
        </button>

        {step < 5 ? (
          <button
            onClick={() => setStep(stepAfter(step))}
            disabled={step === 1 && !connected}
            className="px-8 py-2 bg-ink text-black font-black rounded hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[4px_4px_0px_rgba(157,13,242,0.5)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {t("wizard.next")}
          </button>
        ) : (
          <button
            onClick={handleInstall}
            disabled={installState === "running"}
            className="px-8 py-2 bg-danger text-ink font-black rounded hover:bg-red-500 transition-all disabled:opacity-50 shadow-[4px_4px_0px_rgba(255,77,77,0.4)] active:translate-x-1 active:translate-y-1 active:shadow-none"
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
