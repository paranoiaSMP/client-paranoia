package gg.paranoia.client.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.Setting;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Lecture et ecriture de {@code config/paranoia-client.json}.
 *
 * <p>Le fichier vit dans le dossier de configuration de l'instance, donc chaque
 * profil du launcher garde ses propres reglages -- comme ses mods et ses mondes.
 *
 * <p>Un fichier corrompu ou ecrit par une version plus recente ne doit jamais
 * empecher le jeu de demarrer: toute valeur illisible retombe sur son defaut.
 */
public final class ParanoiaConfig {
    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient/Config");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final String FILE_NAME = "paranoia-client.json";

    private ParanoiaConfig() {
    }

    private static Path configFile() {
        return FabricLoader.getInstance().getConfigDir().resolve(FILE_NAME);
    }

    public static void load(List<Module> modules) {
        Path path = configFile();
        if (!Files.exists(path)) {
            LOGGER.info("Aucune configuration existante, valeurs par defaut utilisees");
            return;
        }

        JsonObject root;
        try {
            root = JsonParser.parseString(Files.readString(path)).getAsJsonObject();
        } catch (IOException | RuntimeException err) {
            // Fichier tronque, JSON invalide, disque illisible: on repart des
            // defauts plutot que de refuser de demarrer.
            LOGGER.warn("Configuration illisible ({}), valeurs par defaut utilisees", err.toString());
            return;
        }

        for (Module module : modules) {
            JsonElement entry = root.get(module.id());
            if (entry == null || !entry.isJsonObject()) {
                continue;
            }
            readModule(module, entry.getAsJsonObject());
        }
    }

    private static void readModule(Module module, JsonObject json) {
        JsonElement enabled = json.get("enabled");
        if (enabled != null && enabled.isJsonPrimitive() && enabled.getAsJsonPrimitive().isBoolean()) {
            module.setEnabled(enabled.getAsBoolean());
        }

        JsonElement settings = json.get("settings");
        if (settings != null && settings.isJsonObject()) {
            JsonObject settingsJson = settings.getAsJsonObject();
            for (Setting<?> setting : module.settings()) {
                // Chaque Setting valide lui-meme ce qu'il lit et ignore ce qui
                // ne correspond pas a son type.
                setting.fromJson(settingsJson.get(setting.id()));
            }
        }

        if (module instanceof HudElement hud) {
            JsonElement layout = json.get("layout");
            if (layout != null && layout.isJsonObject()) {
                readLayout(hud.layout(), layout.getAsJsonObject());
            }
        }
    }

    private static void readLayout(HudLayout layout, JsonObject json) {
        double x = readDouble(json, "x", Double.NaN);
        double y = readDouble(json, "y", Double.NaN);
        if (!Double.isNaN(x) && !Double.isNaN(y)) {
            layout.setFractions(x, y);
        }

        double scale = readDouble(json, "scale", Double.NaN);
        if (!Double.isNaN(scale)) {
            layout.setScale((float) scale);
        }

        double opacity = readDouble(json, "opacity", Double.NaN);
        if (!Double.isNaN(opacity)) {
            layout.setOpacity((float) opacity);
        }

        JsonElement background = json.get("background");
        if (background != null && background.isJsonPrimitive()) {
            for (BackgroundStyle style : BackgroundStyle.values()) {
                if (style.name().equals(background.getAsString())) {
                    layout.setBackground(style);
                    break;
                }
            }
        }

        JsonElement shadow = json.get("textShadow");
        if (shadow != null && shadow.isJsonPrimitive() && shadow.getAsJsonPrimitive().isBoolean()) {
            layout.setTextShadow(shadow.getAsBoolean());
        }
    }

    private static double readDouble(JsonObject json, String key, double fallback) {
        JsonElement element = json.get(key);
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isNumber()) {
            return fallback;
        }
        return element.getAsDouble();
    }

    public static void save(List<Module> modules) {
        JsonObject root = new JsonObject();

        for (Module module : modules) {
            JsonObject entry = new JsonObject();
            // On enregistre le choix du joueur, pas l'etat effectif: un module
            // interdit par le serveur ne doit pas revenir desactive une fois
            // parti sur un autre serveur.
            entry.addProperty("enabled", module.enabledByPlayer());

            JsonObject settings = new JsonObject();
            for (Setting<?> setting : module.settings()) {
                settings.add(setting.id(), setting.toJson());
            }
            entry.add("settings", settings);

            if (module instanceof HudElement hud) {
                entry.add("layout", writeLayout(hud.layout()));
            }

            root.add(module.id(), entry);
        }

        Path path = configFile();
        try {
            Files.createDirectories(path.getParent());
            Files.writeString(path, GSON.toJson(root));
        } catch (IOException err) {
            LOGGER.warn("Configuration non enregistree: {}", err.toString());
        }
    }

    private static JsonObject writeLayout(HudLayout layout) {
        JsonObject json = new JsonObject();
        json.addProperty("x", layout.xFraction());
        json.addProperty("y", layout.yFraction());
        json.addProperty("scale", layout.scale());
        json.addProperty("opacity", layout.opacity());
        json.addProperty("background", layout.background().name());
        json.addProperty("textShadow", layout.textShadow());
        return json;
    }
}
