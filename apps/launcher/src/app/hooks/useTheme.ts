import { useEffect, useState } from "react";

import {
  msAvantMinuit,
  resoudreTheme,
  type ThemeId,
  type ThemePreference,
} from "../theme/season";

/**
 * Le thème appliqué à la fenêtre, et son réveil à minuit.
 *
 * <p>Le thème vit dans un attribut du document et non dans une classe React:
 * les jetons de couleur sont des propriétés CSS redéfinies sous
 * {@code :root[data-theme="halloween"]}, et le navigateur recalcule tout seul
 * tout ce qui en dépend. Aucun composant n'a donc à savoir quel thème est en
 * cours pour s'afficher de la bonne couleur.
 *
 * <p>Le minuteur n'est pas un détail. Un launcher reste ouvert des heures, et
 * souvent toute la nuit. Sans lui, celui qui l'a démarré le 30 septembre ne
 * verrait Halloween qu'au prochain lancement, et celui qui joue dans la nuit du
 * 2 au 3 novembre garderait la décoration jusqu'à ce qu'il relance. On se
 * réveille donc au prochain minuit local, puis on se réarme.
 *
 * <p>Un intervalle de vingt-quatre heures aurait dérivé d'une heure deux fois
 * par an, aux changements d'heure, et aurait fait basculer le thème en plein
 * après-midi.
 */
export function useTheme(preference: ThemePreference): ThemeId {
  const [theme, setTheme] = useState<ThemeId>(() => resoudreTheme(preference));

  useEffect(() => {
    let minuteur: ReturnType<typeof setTimeout>;

    const appliquer = () => {
      setTheme(resoudreTheme(preference));
      // Une seconde de marge: un minuteur qui se déclenche une poignée de
      // millisecondes trop tôt retomberait sur la veille et se réarmerait
      // aussitôt pour la même nuit.
      minuteur = setTimeout(appliquer, msAvantMinuit() + 1_000);
    };

    appliquer();
    return () => clearTimeout(minuteur);
  }, [preference]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return theme;
}
