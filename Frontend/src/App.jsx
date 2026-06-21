import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import LoadingIndicator from "./components/common/LoadingIndicator.jsx";
import ProtectedRoute from "./pages/ProtectedRoute.jsx";
import AdminPlanRoute from "./pages/AdminPlanRoute.jsx";
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterNewuserPage = lazy(() => import("./pages/RegisterNewuserPage.jsx"));
const RegisterDairyPage = lazy(() => import("./pages/RegisterDairyPage.jsx"));
const ExploreDairiesPage = lazy(() => import("./pages/public/ExploreDairiesPage.jsx"));
const DairyDetailsPage = lazy(() => import("./pages/public/DairyDetailsPage.jsx"));
const BuyOncePage = lazy(() => import("./pages/public/BuyOncePage.jsx"));

const DairyCustomerDashboard = lazy(() => import("./pages/customer/DairyCustomerDashboard.jsx"));
const Deliveries = lazy(() => import("./pages/customer/CustomerDeliveryHistory.jsx"));
const Subscription = lazy(() => import("./pages/customer/CustomerSubscription.jsx"));
const Payments = lazy(() => import("./pages/customer/CustomerPayments.jsx"));
const Profile = lazy(() => import("./pages/customer/CustomerProfile.jsx"));
const TrackAgent = lazy(() => import("./pages/customer/TrackAgent.jsx"));

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers.jsx"));
const AdminAgents = lazy(() => import("./pages/admin/AdminAgents.jsx"));
const AdminDeliveries = lazy(() => import("./pages/admin/AdminDeliveries.jsx"));
const AdminPayments = lazy(() => import("./pages/admin/AdminPayments.jsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.jsx"));
const AdminPerformanceDashboard = lazy(() => import("./pages/admin/AdminPerformanceDashboard.jsx"));
const AdminProcurement = lazy(() => import("./pages/admin/AdminProcurement.jsx"));
const AdminSuppliers = lazy(() => import("./pages/admin/AdminSuppliers.jsx"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile.jsx"));

const AgentDashboard = lazy(() => import("./pages/agent/agentDashboard.jsx"));
const AgentHistory = lazy(() => import("./pages/agent/AgentHistory.jsx"));
const AgentProfile = lazy(() => import("./pages/agent/AgentProfile.jsx"));
const AgentWorkingPage = lazy(() => import("./pages/agent/AgentWorkingPage.jsx"));
const AgentBuildingTasksPage = lazy(() => import("./pages/agent/AgentBuildingTasksPage.jsx"));

const RouteFallback = () => (
  <LoadingIndicator fullScreen message="Loading page..." />
);

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/explore" element={<ExploreDairiesPage />} />
        <Route path="/join/:id" element={<DairyDetailsPage />} />
        <Route path="/buy-once/:id" element={<BuyOncePage />} />
        <Route path="/customer/register" element={<RegisterNewuserPage />} />
        <Route path="/register-dairy" element={<RegisterDairyPage />} />

        <Route
          path="/customer/dashboard"
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]}>
              <DairyCustomerDashboard />
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
          path="/customer/track/:orderId"
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

        <Route
          path="/admin/AdminDashboard"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
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
        <Route
          path="/admin/agents"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminPlanRoute feature="agents">
                <AdminAgents />
              </AdminPlanRoute>
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
        <Route
          path="/admin/deliveries"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminDeliveries />
            </ProtectedRoute>
          }
        />
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
        <Route
          path="/admin/performance"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminPlanRoute feature="performance">
                <AdminPerformanceDashboard />
              </AdminPlanRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/procurement"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminPlanRoute feature="procurement">
                <AdminProcurement />
              </AdminPlanRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/suppliers"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminPlanRoute feature="suppliers">
                <AdminSuppliers />
              </AdminPlanRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/profile"
          element={
            <ProtectedRoute allowedRoles={["ADMIN"]}>
              <AdminProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agent/dashboard"
          element={
            <ProtectedRoute allowedRoles={["AGENT", "STAFF"]}>
              <AgentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/working"
          element={
            <ProtectedRoute allowedRoles={["AGENT", "STAFF"]}>
              <AgentWorkingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/working/building/:buildingName"
          element={
            <ProtectedRoute allowedRoles={["AGENT", "STAFF"]}>
              <AgentBuildingTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/profile"
          element={
            <ProtectedRoute allowedRoles={["AGENT", "STAFF"]}>
              <AgentProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent/history"
          element={
            <ProtectedRoute allowedRoles={["AGENT", "STAFF"]}>
              <AgentHistory />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
