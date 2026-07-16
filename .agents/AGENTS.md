## Design Rules (UI/UX)
1. **Clarté visuelle et hiérarchie** : Suivre la règle de lecture en F ou Z. Un seul <h1> par page. Garder des espaces vides (White Space).
2. **Accessibilité et contrastes** : Ratio de contraste de 4.5:1. Police d'au moins 16px.
3. **UX et navigation** : Règle des 3 clics. Consistance du design. Mobile-first.
4. **Performance** : Utiliser WebP/SVG, limiter les effets et animations lourdes.
5. **Alignement et grille** : Utiliser la grille (12 colonnes), espacements cohérents (multiples de 8px : p-4, p-8, etc.).
6. **Psychologie des couleurs** : Règle des 60-30-10. Pas plus de 3 couleurs dominantes.
7. **Typographie** : 2 polices (Outfit pour les titres, Inter pour le texte). Limiter la largeur des textes longs (ex: max-w-2xl).
8. **Affordance et États (UI)** : Chaque élément cliquable doit avoir un état Hover, Active, et Focus (pour l'accessibilité).
9. **Above the Fold** : Hero section claire : Message compris en 3 secondes + Call To Action évident.

# Web Development Guidelines

## Architecture and Stack
- Use a component-based framework like React/Next.js for SSG (Static Site Generation) or ISR (Incremental Static Regeneration).
- Use Tailwind CSS for styling to maintain clean design and consistency.
- Use PostgreSQL (via Supabase or Neon) for scalable relational databases.

## UX / UI
- Mobile-First: Code for mobile first, then adapt for desktop using Tailwind breakpoints (md:, lg:).
- Image Loading: Convert images to .webp or .avif. Use lazy loading. In Next.js, use the <Image/> component.
- Fluidity: Add proper loading states (skeletons) instead of blank screens or long spinners.

## Development Performance
- Zero Main Thread Blocking: Optimize JS. Heavy processing or async data manipulation must be done server-side (SSR / Server Actions) or asynchronously.
- Security: Secure API requests (use .env for keys, no secrets in frontend code). Validate data server-side to prevent SQL/NoSQL injections.
- Git & CI/CD: Commit cleanly, configure .gitignore properly (ignore node_modules, system files), and connect repo to Vercel for CI/CD.

## SEO and Accessibility
- Meta Tags: properly fill title, description, and Open Graph tags.
- Semantic HTML: Use meaningful tags (<header>, <main>, <nav>, <footer>, <h1> to <h6>) instead of only <div> for screen readers and SEO.

## Code Quality and Structure (The Human Touch)
- Avoid "Garbage Components": Split large components into smaller, logical parts (e.g., TableHeaders, TableRow, TableSkeleton). Extract fetch logic into custom hooks.
- Remove Useless Comments: Do not write obvious comments like // This is the state. Code should be self-explanatory. Only comment to explain complex business logic or technical hacks ("Why", not "How").
- Keep Architecture Simple: Do not over-engineer with heavy libraries like Redux for small projects. Use React Context or a tiny Zustand store if needed.

## Design and Tailwind (The Human Touch)
- Ban Generic "SaaS Tech" Templates: Avoid the standard dark theme with slate borders, purple gradient buttons, and background glow. Be unique.
- Typography: Use character fonts (geometric sans-serif or elegant serif) instead of standard system fonts.
- Micro-interactions: Give life to the UI with smooth transitions (e.g., transition-all duration-200 ease-in-out hover:scale-[1.02]) and active states (active:scale-95) for physical feedback.

## Content and Copywriting (The Human Touch)
- No AI Jargon: Avoid empty corporate phrases like "Revolutionize your workflow with our cutting-edge solution". Use direct, friendly, and authentic language (e.g., "Gère ton serveur sans te prendre la tête").
- Use Real Data: Never use "Lorem Ipsum", "Item 1", or generic names like "John Doe". Use realistic, thematic, or funny data during development.
