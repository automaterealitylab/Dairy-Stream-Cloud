// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import {useAuth} from "./hooks/useAuth.jsx";

const DEFAULT_REDIRECT = "/";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  // ⏳ Wait until auth state is restored
  if (loading) {
    return null; // or a spinner component later
  }

  const userRole = user?.role || localStorage.getItem("userRole");

  // 🔒 Not logged in
  if (!userRole) {
    return <Navigate to={DEFAULT_REDIRECT} replace />;
  }

  // 🔐 Role-based protection
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to={DEFAULT_REDIRECT} replace />;
  }

  return children;
};

export default ProtectedRoute;
