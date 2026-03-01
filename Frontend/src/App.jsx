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
import BuyOncePage from "./pages/public/BuyOncePage.jsx";

// --- Customer Pages ---
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import Deliveries from "./pages/customer/CustomerDeliveryHistory.jsx";
import Subscription from "./pages/customer/CustomerSubscription.jsx";
import Payments from "./pages/customer/CustomerPayments.jsx";
import Profile from "./pages/customer/CustomerProfile.jsx";

// --- Admin Pages ---
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCustomers from "./pages/admin/AdminCustomers";
// ⚠️ Ensure these files exist, even if empty placeholders for now:
import AdminAgents from "./pages/admin/AdminAgents.jsx"; 
import AdminDeliveries from "./pages/admin/AdminDeliveries"; 
import AdminPayments from "./pages/admin/AdminPayments"; 
import AdminProducts from "./pages/admin/AdminProducts.jsx";

// --- Agent Pages ---
import AgentDashboard from "./pages/agent/agentDashboard.jsx";
import AgentHistory from "./pages/agent/AgentHistory.jsx";
import AgentProfile from "./pages/agent/AgentProfile.jsx";
import AgentWorkingPage from "./pages/agent/AgentWorkingPage.jsx";
import ThemeToggleButton from "./components/common/ThemeToggleButton.jsx";
import TrackAgent from "./pages/customer/TrackAgent.jsx";



function App() {
  return (
    <>
    <ThemeToggleButton />
    <Routes>
      {/* ==============================
          🔓 PUBLIC ROUTES
      ============================== */}
      <Route path="/" element={<LoginPage />} />
      <Route path="/explore" element={<ExploreDairiesPage />} />
      <Route path="/join/:id" element={<DairyDetailsPage />} />
      <Route path="/buy-once/:id" element={<BuyOncePage />} />
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
        path="/customer/dashboard/track/agent"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <TrackAgent />
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
            <Navigate to="/admin/customers?addCustomer=1" replace />
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
            <Navigate to="/admin/agents?addAgent=1" replace />
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
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute allowedRoles={["ADMIN"]}>
            <AdminProducts />
          </ProtectedRoute>
        }
      />


      {/* ==============================
          🚚 AGENT ROUTES (Protected)
      ============================== */}
        <Route path="/agent/dashboard" element={<AgentDashboard />} />
      <Route path="/agent/working" element={<AgentWorkingPage />} />
      <Route path="/agent/profile" element={<AgentProfile />} />
      <Route path="/agent/history" element={<AgentHistory />} />


      {/* ==============================
          ⛔ 404 CATCH-ALL
      ============================== */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
