// src/components/PublicRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const PublicRoute = ({ children }) => {
  const userRole = localStorage.getItem("userRole");

  if (userRole === 'CUSTOMER') return <Navigate to="/customer-dashboard" replace />;
  if (userRole === 'ADMIN') return <Navigate to="/admin/AdminDashboard" replace />;
  if (userRole === 'STAFF') return <Navigate to="/staff-dashboard" replace />;

  return children;
};

export default PublicRoute;
