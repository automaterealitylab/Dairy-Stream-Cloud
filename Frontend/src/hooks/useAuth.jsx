import { createContext, useContext, useEffect, useState } from "react";
import { validateTokenApi } from "../services/auth.api";

const AuthContext = createContext(null);
const DASHBOARD_VISITED_FLAG = "customerDashboardVisited";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

          setUser(parsedUser);

          // Keep agent sessions stable across refresh even if /auth/me is not reliable.
          if (hasAgentSession) {
            if (!localStorage.getItem("agentToken") && parsedUser?.token) {
              localStorage.setItem("agentToken", parsedUser.token);
            }
            localStorage.setItem("userRole", normalizedRole || "AGENT");
            setLoading(false);
            return;
          }

          // Try to validate the token with the backend using the correct role token.
          const response = await validateTokenApi(parsedUser?.role);
          if (response.success) {
            // Token is valid, update user with fresh data and preserve token/role.
            const nextUser = {
              ...parsedUser,
              ...response.user,
              token: parsedUser?.token,
              role: response.role || response.user?.role || parsedUser?.role,
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
          console.log("Token validation failed:", error.message);

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
    window.location.href = "/login"; // Force redirect to login on logout
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
