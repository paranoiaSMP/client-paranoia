export type ReleaseChannel = "stable" | "beta";

export interface MicrosoftAccount {
  id: string;
  minecraftUuid: string;
  minecraftUsername: string;
  skinUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface MicrosoftAuthUrlResponse {
  authorizeUrl: string;
}

export interface MicrosoftAuthCallbackRequest {
  code: string;
  state: string;
  redirectUri: string;
}

export interface ProfileTypeDefinition {
  id: string;
  label: string;
  description: string;
}

export interface GraphicsModeDefinition {
  id: string;
  label: string;
  description: string;
}

export interface FileArtifact {
  id: string;
  kind: "mod" | "resource-pack" | "shader" | "config" | "custom";
  fileName: string;
  downloadUrl: string;
  sha256: string;
  size: number;
  targetPath: string;
  optional?: boolean;
}

/**
 * Le mod Paranoia lui-meme.
 *
 * <p>Il ne passe pas par `artifacts`: ceux-ci sont installes dans le dossier de
 * l'instance, alors que le mod client vit hors du dossier `mods` et est charge
 * par un argument JVM. Un joueur ne peut donc ni le supprimer par accident, ni
 * en garder une vieille copie, ni le confondre avec les mods qu'il installe.
 */
export interface ClientModArtifact {
  fileName: string;
  downloadUrl: string;
  sha256: string;
  size: number;
}

export interface InstallationManifest {
  id: string;
  minecraftVersion: string;
  fabricLoaderVersion?: string;
  requiredJavaMajor?: number;
  profileTypeId: string;
  graphicsModeId: string;
  artifacts: FileArtifact[];
  clientMod?: ClientModArtifact;
  generatedAt: string;
  signature: string;
}

export interface LauncherProfile {
  id: string;
  name: string;
  minecraftVersion: string;
  profileTypeId: string;
  graphicsModeId: string;
  favorite: boolean;
  ramMb: number;
  resolution: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLauncherProfileRequest {
  name: string;
  minecraftVersion: string;
  profileTypeId: string;
  graphicsModeId: string;
  ramMb: number;
  resolution: string;
  optionsTxtPath?: string | undefined;
}

export interface CreateManifestRequest {
  minecraftVersion: string;
  profileTypeId: string;
  graphicsModeId: string;
  locale?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  imageUrl?: string;
  publishedAt: string;
  tags: string[];
}

export interface ServerStatus {
  online: boolean;
  motd: string;
  pingMs: number;
  playerCount: number;
  maxPlayers: number;
}

export interface CosmeticItem {
  id: string;
  type: "cape" | "wings" | "halo" | "hat" | "particle" | "emote";
  name: string;
  previewUrl: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export interface RemoteConfiguration {
  schemaVersion: string;
  releaseChannel: ReleaseChannel;
  profileTypes: ProfileTypeDefinition[];
  graphicsModes: GraphicsModeDefinition[];
  supportedMinecraftVersions: string[];
}
