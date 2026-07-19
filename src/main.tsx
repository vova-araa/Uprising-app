import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initPerfMonitor } from "./lib/perfMonitor";

initPerfMonitor();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Register the service worker for PWA offline support + push. Native
// (Capacitor) builds skip this — they use native push instead.
if ("serviceWorker" in navigator && !(window as any).Capacitor?.isNativePlatform?.()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw-push.js").catch((e) => console.warn("SW registration failed:", e));
  });
}

