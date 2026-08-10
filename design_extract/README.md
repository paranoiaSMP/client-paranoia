# Principale page — React + Tailwind

Implémentation autonome de la frame Figma `Game UI` en React, TypeScript et Tailwind CSS.

## Démarrage

```bash
npm install
npm run dev
```

Build de production :

```bash
npm run build
```

## Intégration dans une application existante

Copiez :

- `src/components/GameUi.tsx`
- `public/assets/slide-indicators.svg`
- `public/assets/plus-square.svg`

Puis importez le composant :

```tsx
import { GameUi } from "./components/GameUi";

export default function Page() {
  return (
    <GameUi
      instances={["Instance A", "Instance B", "Instance C"]}
      onAdd={() => console.log("Ajouter")}
      onPlay={() => console.log("Lecture")}
      onSettings={() => console.log("Paramètres")}
    />
  );
}
```

Le composant dépend de `motion` pour reproduire l’animation Figma du panneau de paramètres. L’animation est automatiquement neutralisée lorsque l’utilisateur active la réduction des animations dans son système.

## Référence

La capture Figma utilisée pour la comparaison visuelle est conservée dans `reference/figma-reference.png`.
