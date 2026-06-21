import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./hooks/useAuth.jsx";
import { initTheme } from "./components/admin/adminTheme.js";

// Initialize Theme
initTheme();

if (import.meta.env.DEV) {
  import("./utils/adminDebug.js").then(({ default: debugAdmin }) => {
    window.__debugAdmin = debugAdmin;
  });
}

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
