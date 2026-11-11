import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import LoadingIndicator from "./LoadingIndicator.jsx";

import LoginPage from "../../pages/LoginPage.jsx";

const RouteReadyNotifier = ({ onReady }) => {
  useEffect(() => {
    onReady?.();
  }, [onReady]);
  return null;
};

const getRoleHomePath = (role) => {
  const normalizedRole = String(role || "").toUpperCase();
  if (normalizedRole === "ADMIN") return "/admin/AdminDashboard";
  if (normalizedRole === "AGENT" || normalizedRole === "STAFF") return "/agent/dashboard";
  if (normalizedRole === "CUSTOMER") return "/customer/dashboard";
  if (["SUPER_ADMIN", "OWNER", "COMPANY_STAFF"].includes(normalizedRole)) return "/super-admin/dashboard";
  return null;
};

const AuthLandingRoute = ({ onReady }) => {
  const { user, loading } = useAuth();

  const role = user?.role || localStorage.getItem("userRole");
  const homePath = getRoleHomePath(role);

  useEffect(() => {
    if (!loading && homePath) {
      onReady?.();
    }
  }, [loading, homePath, onReady]);

  if (loading) {
    return <LoadingIndicator fullScreen message="Restoring session..." />;
  }

  if (homePath) {
    return <Navigate to={homePath} replace />;
  }

  return (
    <>
      <LoginPage />
      <RouteReadyNotifier onReady={onReady} />
    </>
  );
};

export default AuthLandingRoute;