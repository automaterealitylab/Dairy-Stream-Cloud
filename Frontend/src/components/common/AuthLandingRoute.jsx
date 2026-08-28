import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import LoadingIndicator from "./LoadingIndicator.jsx";

const getRoleHomePath = (role) => {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "ADMIN") return "/admin/AdminDashboard";
  if (normalizedRole === "AGENT" || normalizedRole === "STAFF") return "/agent/dashboard";
  if (normalizedRole === "CUSTOMER") return "/customer/dashboard";
  if (["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(normalizedRole)) return "/super-admin/dashboard";
  return null;
};

const AuthLandingRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingIndicator fullScreen message="Restoring session..." />;
  }

  const role = user?.role || localStorage.getItem("userRole");
  const homePath = getRoleHomePath(role);

  if (homePath) {
    return <Navigate to={homePath} replace />;
  }

  const LoginPage = React.lazy(() => import("../../pages/LoginPage.jsx"));
  return (
    <React.Suspense fallback={<LoadingIndicator fullScreen message="Loading..." />}>
      <LoginPage />
    </React.Suspense>
  );
};

export default AuthLandingRoute;