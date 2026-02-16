import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Route, Routes, Navigate } from "react-router-dom";

// --- Components ---
import ProtectedRoute from "./pages/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterNewuserPage from "./pages/RegisterNewuserPage";
import RegisterDairyPage from "./pages/RegisterDairyPage";
import ExploreDairiesPage from "./pages/public/ExploreDairiesPage";
import DairyDetailsPage from "./pages/public/DairyDetailsPage";

// --- Customer Pages ---
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import Deliveries from "./pages/customer/CustomerDeliveries.jsx";
import Subscription from "./pages/customer/CustomerSubscription.jsx";
import Payments from "./pages/customer/CustomerPayments.jsx";
import Profile from "./pages/customer/CustomerProfile.jsx";

// --- Admin Pages ---
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AddNewCustomerForm from "./pages/admin/AddNewCustomerForm";
import AddNewAgentForm from "./pages/admin/AddNewAgentForm";
// ⚠️ Ensure these files exist, even if empty placeholders for now:
import AdminAgents from "./pages/admin/AdminAgents.jsx"; 
import AdminDeliveries from "./pages/admin/AdminDeliveries"; 
import AdminPayments from "./pages/admin/AdminPayments"; 

// --- Agent Pages ---
import AgentDashboard from "./pages/agent/agentDashboard";


function App() {
  return (
    <Routes>
      {/* ==============================
          🔓 PUBLIC ROUTES
      ============================== */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/explore" element={<ExploreDairiesPage />} />
      <Route path="/join/:id" element={<DairyDetailsPage />} />
      <Route path="/customer/register" element={<RegisterNewuserPage />} />
      <Route path="/register-dairy" element={<RegisterDairyPage />} />


      {/* ==============================
          👤 CUSTOMER ROUTES (Protected)
      ============================== */}
      <Route
        path="/customer/dashboard"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
       
      <Route
        path="/customer/dashboard/deliveries"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <Deliveries />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/dashboard/subscriptions"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <Subscription />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/dashboard/payments"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <Payments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/dashboard/profile"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <Profile />
          </ProtectedRoute>
        }
      />


      {/* ==============================
          🛡️ ADMIN ROUTES (Protected)
      ============================== */}
      {/* Dashboard */}
      <Route
        path="/admin/AdminDashboard"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Customers Section */}
      <Route
        path="/admin/customers"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminCustomers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/addCustomer"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AddNewCustomerForm />
          </ProtectedRoute>
        }
      />

      {/* Agents Section (This was missing!) */}
      <Route
        path="/admin/agents"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminAgents /> 
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/addagent"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AddNewAgentForm />
          </ProtectedRoute>
        }
      />

      {/* Deliveries Section (This was missing!) */}
      <Route
        path="/admin/deliveries"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminDeliveries />
          </ProtectedRoute>
        }
      />

      {/* Payments Section (This was missing!) */}
      <Route
        path="/admin/payments"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminPayments />
          </ProtectedRoute>
        }
      />


      {/* ==============================
          🚚 AGENT ROUTES (Protected)
      ============================== */}
      <Route
        path="/agent-dashboard"
        element={
          <ProtectedRoute allowedRoles={["STAFF"]}>
            <AgentDashboard />
          </ProtectedRoute>
        }
      />


      {/* ==============================
          ⛔ 404 CATCH-ALL
      ============================== */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;