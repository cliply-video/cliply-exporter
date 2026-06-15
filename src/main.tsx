import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { I18nProvider } from "./i18n";
// Bundled fonts (offline-safe): display + body.
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/hanken-grotesk";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("missing #root element");

createRoot(container).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
