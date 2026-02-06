// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRoles }) => {
  // 1. Get the role from storage
  const userRole = localStorage.getItem("userRole"); 
  
  // 2. If not logged in, send to Login Page
  if (!userRole) {
    return <Navigate to="/" replace />;
  }

  // 3. (Optional) Role-Based Access Control
  // If the user's role is not in the 'allowedRoles' list, redirect them
  if (allowedRoles && !allowedRoles.includes(userRole)) {
     // You can redirect to a "Not Authorized" page or their dashboard
     return <Navigate to="/" replace />; 
  }

  // 4. If all checks pass, render the page
  return children;
};

export default ProtectedRoute;