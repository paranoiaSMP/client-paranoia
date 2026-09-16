import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

// Les deux polices etaient declarees dans styles.css et installees dans
// package.json, mais importees nulle part: le launcher s'affichait depuis le
// debut dans la police systeme, en croyant afficher Inter. Elles sont
// embarquees et non chargees depuis Google Fonts, parce qu'un launcher doit
// savoir s'afficher sans reseau.
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";

import "./styles.css";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
