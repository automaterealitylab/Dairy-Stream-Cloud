// src/components/PublicRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth.jsx";
import LoadingIndicator from "../components/common/LoadingIndicator.jsx";

const ROLE_REDIRECT_MAP = {
  CUSTOMER: "/customer/dashboard",
  ADMIN: "/admin/AdminDashboard",
  STAFF: "/staff-dashboard",
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingIndicator fullScreen message="Checking session..." />;

  const userRole = user?.role || localStorage.getItem("userRole");

  if (userRole && ROLE_REDIRECT_MAP[userRole]) {
    return <Navigate to={ROLE_REDIRECT_MAP[userRole]} replace />;
  }

  return children;
};

export default PublicRoute;
