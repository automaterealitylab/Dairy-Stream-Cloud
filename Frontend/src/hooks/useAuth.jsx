import { createContext, useContext, useEffect, useState } from "react";
import { validateTokenApi } from "../services/auth.api";

const AuthContext = createContext(null);
const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";

const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(window.atob(base64));
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return true; // Expired
    }
    return false; // Not expired
  } catch {
    return true; // Invalid token format
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isValidatedSession = (response) => {
      if (!response || typeof response !== "object") return false;
      if (response.success === true) return true;
      if (response.user && typeof response.user === "object") return true;
      if (response.id || response.email || response.role || response.userType) return true;
      return false;
    };

    const validateStoredToken = async () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          const normalizedRole = String(parsedUser?.role || localStorage.getItem("userRole") || "").toUpperCase();
          const hasAgentSession = Boolean(
            (normalizedRole === "AGENT" || normalizedRole === "STAFF") &&
              (localStorage.getItem("agentToken") || parsedUser?.token)
          );

          // Get token to check local expiration
          const token = parsedUser?.token || 
            (normalizedRole === "ADMIN" ? localStorage.getItem("adminToken") :
             (normalizedRole === "AGENT" || normalizedRole === "STAFF") ? localStorage.getItem("agentToken") :
             ["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(normalizedRole) ? localStorage.getItem("superAdminToken") :
             localStorage.getItem("token"));

          if (isTokenExpired(token)) {
            setUser(null);
            localStorage.removeItem("user");
            localStorage.removeItem("userRole");
            localStorage.removeItem("token");
            localStorage.removeItem("adminToken");
            localStorage.removeItem("agentToken");
            localStorage.removeItem("superAdminToken");
            setLoading(false);
            return;
          }

          // Optimistically restore session and finish loading state
          setUser(parsedUser);
          setLoading(false);

          // Keep agent sessions stable across refresh even if /auth/me is not reliable.
          if (hasAgentSession) {
            if (!localStorage.getItem("agentToken") && parsedUser?.token) {
              localStorage.setItem("agentToken", parsedUser.token);
            }
            localStorage.setItem("userRole", normalizedRole || "AGENT");
            return;
          }

          // Validate in background to verify token hasn't been revoked
          try {
            const response = await validateTokenApi(parsedUser?.role);
            if (isValidatedSession(response)) {
              const nextUser = {
                ...parsedUser,
                ...(response.user || response),
                token: parsedUser?.token,
                role: response.role || response.user?.role || response.userType || parsedUser?.role,
              };
              setUser(nextUser);
              localStorage.setItem("user", JSON.stringify(nextUser));
              localStorage.setItem("userRole", nextUser.role);
            } else {
              setUser(null);
              localStorage.removeItem("user");
              localStorage.removeItem("userRole");
              localStorage.removeItem("token");
              localStorage.removeItem("adminToken");
              localStorage.removeItem("agentToken");
            }
          } catch (error) {
            const status = Number(error?.response?.status || 0);
            if (status !== 401 && status !== 403) {
              console.log("Background token validation failed:", error.message);
            }

            // Only clear auth when the backend explicitly rejects the token.
            if (status === 401 || status === 403) {
              setUser(null);
              localStorage.removeItem("user");
              localStorage.removeItem("userRole");
              localStorage.removeItem("token");
              localStorage.removeItem("adminToken");
              localStorage.removeItem("agentToken");
            }
          }
          return;
        } catch (err) {
          console.error("Error reading stored session:", err);
        }
      }
      setLoading(false);
    };

    validateStoredToken();
  }, []);

  const login = (data) => {
    // We normalize the data so the role is always accessible at the top level
    const userData = {
      token: data.token,
      role: data.role || data.user?.role,
      ...data.user,
    };
    const normalizedRole = String(userData.role || "").toUpperCase();

    if (userData.token) {
      if (normalizedRole === "ADMIN") {
        localStorage.setItem("adminToken", userData.token);
      } else if (normalizedRole === "AGENT" || normalizedRole === "STAFF") {
        localStorage.setItem("agentToken", userData.token);
      } else if (["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(normalizedRole)) {
        localStorage.setItem("superAdminToken", userData.token);
      } else if (normalizedRole === "CUSTOMER") {
        localStorage.setItem("token", userData.token);
      }
    }

    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("userRole", userData.role);
  };

  const logout = () => {
    setUser(null);
    localStorage.clear(); // Clears all tokens and user data safely
    sessionStorage.removeItem(DASHBOARD_VISITED_FLAG);
    window.location.href = "/"; // Force redirect to root path on logout
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// ✅ ENSURE THIS IS EXPORTED AS A NAMED EXPORT
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
