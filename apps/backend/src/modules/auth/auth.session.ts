import {
  deleteAccount,
  getAccount,
  isExpired,
  listAccounts,
  saveAccount,
  type StoredAccount,
} from "./accounts.store.js";
import {
  EchecRenouvellement,
  refreshMicrosoftAccount,
} from "./auth.microsoft.js";

/**
 * Une session Minecraft utilisable pour ce compte, renouvelee si besoin.
 *
 * <p>Un seul endroit pour cette question, parce qu'elle se pose a deux moments
 * qui n'ont pas la meme urgence: au demarrage du launcher, pour afficher le
 * joueur connecte, et juste avant un lancement, ou le jeton part a Minecraft.
 * Le second cas etait jusqu'ici servi par ce que l'interface avait en memoire
 * depuis le demarrage -- un launcher laisse ouvert une journee lancait donc le
 * jeu avec un jeton perime, et Minecraft repondait « Invalid session » apres
 * deux minutes de telechargement. Le joueur en concluait qu'il fallait se
 * reconnecter.
 *
 * @returns null si le compte n'existe pas.
 * @throws EchecRenouvellement -- {@code definitif} dit s'il faut se reconnecter.
 */
export async function sessionUtilisable(
  accountId: string,
): Promise<StoredAccount | null> {
  const compte = getAccount(accountId);
  if (!compte) {
    return null;
  }

  if (!isExpired(compte)) {
    return compte;
  }

  try {
    return saveAccount(await refreshMicrosoftAccount(compte.refreshToken));
  } catch (err) {
    // Le compte n'est oublie que sur un refus explicite de Microsoft. Une
    // panne passagere le laisse en place: le prochain demarrage retentera, et
    // le joueur n'aura rien eu a faire.
    if (err instanceof EchecRenouvellement && err.definitif) {
      deleteAccount(compte.id);
    }
    throw err;
  }
}

/**
 * Le compte a utiliser pour lancer le jeu, par identifiant ou, a defaut, par
 * pseudonyme.
 *
 * <p>Le launcher envoie l'identifiant depuis la 0.7.31; les versions
 * precedentes n'envoyaient que le pseudonyme et le jeton. On retrouve donc le
 * compte enregistre par son pseudonyme quand l'identifiant manque, plutot que
 * de se rabattre sur un jeton qui peut avoir expire.
 */
export function compteParPseudonyme(pseudonyme: string): StoredAccount | null {
  const cible = (pseudonyme || "").toLowerCase();
  if (!cible) {
    return null;
  }
  return (
    listAccounts().find(
      (compte) => (compte.minecraftUsername || "").toLowerCase() === cible,
    ) ?? null
  );
}

/** Ce que le launcher envoie pour jouer. */
export interface DemandeDeSession {
  // `| undefined` explicite: le projet compile avec exactOptionalPropertyTypes,
  // et zod produit la propriete avec la valeur undefined quand elle manque.
  id?: string | undefined;
  minecraftUuid: string;
  minecraftUsername: string;
  accessToken: string;
}

/**
 * La session a donner a Minecraft, renouvelee a l'instant du lancement.
 *
 * <p>Le jeton envoye par l'interface date du demarrage du launcher. Un
 * launcher ouvert depuis la veille lancait donc le jeu avec un jeton perime:
 * Minecraft affiche « Invalid session » apres tout le telechargement, et le
 * joueur se reconnecte en croyant que sa session est perdue. Elle ne l'est
 * pas -- elle n'avait simplement pas ete renouvelee.
 *
 * <p>Un compte inconnu du magasin -- le compte de developpement, ou un profil
 * importe -- garde ce que l'interface a envoye: ce module n'a rien a en dire.
 */
export async function sessionDeLancement(
  demande: DemandeDeSession,
): Promise<DemandeDeSession> {
  const enregistre =
    (demande.id ? getAccount(demande.id) : null) ??
    compteParPseudonyme(demande.minecraftUsername);

  if (!enregistre) {
    return demande;
  }

  if (!isExpired(enregistre)) {
    return {
      id: enregistre.id,
      minecraftUuid: enregistre.minecraftUuid,
      minecraftUsername: enregistre.minecraftUsername,
      accessToken: enregistre.accessToken,
    };
  }

  const renouvelee = await sessionUtilisable(enregistre.id);
  if (!renouvelee) {
    return demande;
  }
  return {
    id: renouvelee.id,
    minecraftUuid: renouvelee.minecraftUuid,
    minecraftUsername: renouvelee.minecraftUsername,
    accessToken: renouvelee.accessToken,
  };
}
