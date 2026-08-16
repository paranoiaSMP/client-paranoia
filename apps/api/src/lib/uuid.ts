const DASHED = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNDASHED = /^[0-9a-f]{32}$/;

/**
 * Ramene un identifiant de compte a une seule forme.
 *
 * <p>Mojang renvoie les UUID sans tirets, Minecraft les manipule avec, et les
 * deux se croisent dans ce service. Comparer les deux formes sans les
 * normaliser donne un ensemble ou le meme joueur figure deux fois sans jamais
 * correspondre a lui-meme -- une panne silencieuse ou le badge n'apparait
 * simplement jamais.
 *
 * @returns la forme minuscule avec tirets, ou `null` si ce n'est pas un UUID.
 */
export function normalizeUuid(value: string): string | null {
  const lower = value.trim().toLowerCase();

  if (DASHED.test(lower)) {
    return lower;
  }

  if (UNDASHED.test(lower)) {
    return [
      lower.slice(0, 8),
      lower.slice(8, 12),
      lower.slice(12, 16),
      lower.slice(16, 20),
      lower.slice(20),
    ].join("-");
  }

  return null;
}
