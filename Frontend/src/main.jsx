import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./hooks/useAuth.jsx";
import debugAdmin from "./utils/adminDebug.js";
import { initTheme } from "./components/admin/adminTheme.js";

// Initialize Theme
initTheme();

// Expose debug utility globally for development
window.__debugAdmin = debugAdmin;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
          }}
        />
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then(() => console.log("Service Worker registered"))
      .catch((err) =>
        console.error("Service Worker registration failed:", err)
      );
  });
}
