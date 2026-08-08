const fs = require('fs');

// 1. Update locales
const updateLocales = () => {
  const frPath = 'apps/launcher/src/locales/fr.json';
  const enPath = 'apps/launcher/src/locales/en.json';

  const frData = JSON.parse(fs.readFileSync(frPath, 'utf8'));
  const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

  frData.translation.mods = {
    "selectProfile": "Sélectionner le profil",
    "openFolder": "Ouvrir le dossier",
    "searchPlaceholder": "Chercher un mod sur Modrinth...",
    "sortByRelevance": "Trier : Pertinence",
    "view": "Afficher :",
    "installing": "Installation...",
    "installedButton": "Installé",
    "installButton": "Ajouter",
    "addToInstance": "Ajouter à l'instance",
    "addedToInstance": "Ajouté à l'instance",
    "by": "par",
    "downloads": "téléchargements",
    "modsOfProfile": "Mods de ce profil",
    "filteredText": "Installés dans ce profil uniquement, filtrés pour Fabric",
    "noMods": "Aucun mod installé sur ce profil.",
    "remove": "Retirer",
    "noProfileHint": "Crée un profil pour installer des mods.",
    "previousPage": "Précédent",
    "nextPage": "Suivant",
    "page": "Page"
  };

  enData.translation.mods = {
    "selectProfile": "Select profile",
    "openFolder": "Open folder",
    "searchPlaceholder": "Search mods on Modrinth...",
    "sortByRelevance": "Sort by: Relevance",
    "view": "View:",
    "installing": "Installing...",
    "installedButton": "Installed",
    "installButton": "Install",
    "addToInstance": "Add to instance",
    "addedToInstance": "Added to instance",
    "by": "by",
    "downloads": "downloads",
    "modsOfProfile": "Mods of this profile",
    "filteredText": "Installed in this profile only, filtered for Fabric",
    "noMods": "No mods installed on this profile.",
    "remove": "Remove",
    "noProfileHint": "Create a profile to install mods.",
    "previousPage": "Previous",
    "nextPage": "Next",
    "page": "Page"
  };

  fs.writeFileSync(frPath, JSON.stringify(frData, null, 2));
  fs.writeFileSync(enPath, JSON.stringify(enData, null, 2));
};

// 2. Update ModsTab.tsx
const updateModsTab = () => {
  const path = 'apps/launcher/src/app/components/tabs/ModsTab.tsx';
  let content = fs.readFileSync(path, 'utf8');

  // Add useTranslation
  if (!content.includes('useTranslation')) {
    content = content.replace('import { useCallback, useEffect, useState } from "react";', 'import { useCallback, useEffect, useState } from "react";\nimport { useTranslation } from "react-i18next";');
  }
  
  // Add i18n hook and pagination state
  content = content.replace('const profile =', 'const { t } = useTranslation();\n  const [page, setPage] = useState(1);\n  const [totalHits, setTotalHits] = useState(0);\n  const profile =');

  // Update searchMods call
  content = content.replace(
    'limit: 20,', 
    'limit: 20,\n        offset: (page - 1) * 20,'
  );
  content = content.replace(
    'setHits(result.hits);',
    'setHits(result.hits);\n      setTotalHits(result.total);'
  );

  // Trigger search when page changes
  content = content.replace(
    'refreshInstalled();\n  }, [refreshInstalled]);',
    'refreshInstalled();\n  }, [refreshInstalled]);\n\n  useEffect(() => {\n    if (query) runSearch();\n  }, [page]);'
  );

  // Reset page when search is submitted manually
  content = content.replace(
    'setSearching(true);',
    '// setSearching(true); (Will be handled)'
  );
  content = content.replace(
    'async function runSearch() {',
    'async function runSearch(resetPage = false) {\n    if (resetPage) setPage(1);\n    setSearching(true);'
  );
  content = content.replace(
    'e.key === "Enter" && runSearch()',
    'e.key === "Enter" && runSearch(true)'
  );


  // Replace texts with t()
  content = content.replace(/"Chercher un mod sur Modrinth\.\.\."/g, 't("mods.searchPlaceholder")');
  content = content.replace(/>Sort by: Relevance </g, '>{t("mods.sortByRelevance")} <');
  content = content.replace(/>View: 20 </g, '>{t("mods.view")} 20 <');
  content = content.replace(/"Sélectionner le profil"/g, 't("mods.selectProfile")');
  content = content.replace(/"Ouvrir le dossier"/g, 't("mods.openFolder")');
  content = content.replace(/>by \{hit\.author\}</g, '>{t("mods.by")} {hit.author}<');
  content = content.replace(/>Installé</g, '>{t("mods.addedToInstance")}<');
  content = content.replace(/>Add to instance</g, '>{t("mods.addToInstance")}<');
  content = content.replace(/>Mods de ce profil /g, '>{t("mods.modsOfProfile")} ');
  content = content.replace(/>Installés dans ce profil uniquement, filtrés pour Fabric /g, '>{t("mods.filteredText")} ');
  content = content.replace(/>Aucun mod installé sur ce profil\.</g, '>{t("mods.noMods")}<');
  content = content.replace(/"Retirer"/g, 't("mods.remove")');
  content = content.replace(/>Crée un profil pour installer des mods\.</g, '>{t("mods.noProfileHint")}<');


  // Add pagination UI
  const filterRowEnd = content.indexOf('</div>\n\n      {localError && (');
  if (filterRowEnd !== -1) {
    const totalPagesStr = 'Math.ceil(totalHits / 20)';
    const paginationUI = `
        {totalHits > 0 && (
          <div className="flex items-center gap-2 text-[#a1a1aa] text-sm font-bold shrink-0">
            <button 
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || searching}
              className="w-8 h-8 flex items-center justify-center bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              &lt;
            </button>
            <span className="px-2">{t("mods.page")} {page} / {${totalPagesStr}}</span>
            <button 
              onClick={() => setPage(Math.min(${totalPagesStr}, page + 1))}
              disabled={page >= ${totalPagesStr} || searching}
              className="w-8 h-8 flex items-center justify-center bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        )}`;
    content = content.slice(0, filterRowEnd) + paginationUI + '\n      ' + content.slice(filterRowEnd);
  }

  fs.writeFileSync(path, content);
};

updateLocales();
