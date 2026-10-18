import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";


import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";

import "./styles.css";
import "./i18n";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
