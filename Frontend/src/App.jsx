import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./pages/ProtectedRoute";
import AddNewCustomerForm from "./pages/admin/AddNewCustomerForm";
import AddNewAgentForm from "./pages/admin/AddNewAgentForm";
import DairyCustomerDashboard from "./pages/customer/DairyCustomerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AgentDashboard from "./pages/agent/agentDashboard";
import AgentWorkingPage from "./pages/agent/AgentWorkingPage";
import AgentProfile from "./pages/agent/AgentProfile";
import AgentHistory from "./pages/agent/AgentHistory";
import LoginPage from "./pages/LoginPage";
import RegisterNewuserPage from "./pages/RegisterNewuserPage";
import RegisterDairyPage from "./pages/RegisterDairyPage";
import ExploreDairiesPage from "./pages/public/ExploreDairiesPage";
import DairyDetailsPage from "./pages/public/DairyDetailsPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import Deliveries from "./pages/customer/Deliveries";
import Subscription from "./pages/customer/Subscription";
import Payments from "./pages/customer/Payments";
import Profile from "./pages/customer/Profile";
import AdminCustomers from "./pages/admin/AdminCustomers";

function App() {
  return (
    <Routes>
      {/* Root/Login Route */}
      <Route path="/" element={<LoginPage />} />

      {/* Public Routes */}
      <Route path="/explore" element={<ExploreDairiesPage />} />
      <Route path="/join/:id" element={<DairyDetailsPage />} />

      {/* Customer Routes - Unprotected for development */}
      <Route path="/customer-dashboard" element={<CustomerDashboard />} />
      <Route path="/customer/deliveries" element={<Deliveries />} />
      <Route path="/customer/subscriptions" element={<Subscription />} />
      <Route path="/customer/payments" element={<Payments />} />
      <Route path="/customer/profile" element={<Profile />} />

      {/* Agent Routes - Unprotected for development */}
      <Route path="/agent/dashboard" element={<AgentDashboard />} />
      <Route path="/agent/working" element={<AgentWorkingPage />} />
      <Route path="/agent/profile" element={<AgentProfile />} />
      <Route path="/agent/history" element={<AgentHistory />} />

      {/* Admin Routes - Unprotected for development */}
      <Route path="/admin/customers" element={<AdminCustomers />} />
      <Route path="/admin/AdminDashboard" element={<AdminDashboard />} />
      <Route path="/admin/addCustomer" element={<AddNewCustomerForm />} />
      <Route path="/admin/addAgent" element={<AddNewAgentForm />} />

      {/* Other Routes */}
      <Route path="/customer/register" element={<RegisterNewuserPage />} />
      <Route path="/customerDashbord" element={<DairyCustomerDashboard />} />
      <Route path="/register-dairy" element={<RegisterDairyPage />} />

      <Route
        path="*"
        element={<h2 className="text-center mt-5">404 - Page Not Found</h2>}
      ></Route>
    </Routes>
  );
}
export default App;

///this is uncommnet after we complete the whole app, so that we can use the protected route and give a smooth exp for the user also prevent clicking the wrong url

// import React from 'react';
// import { Route, Routes } from 'react-router-dom';

// // Import Components
// import ProtectedRoute from './pages/ProtectedRoute'; // <--- Imported
// import PublicRoute from './pages/PublicRoute';       // <--- Imported
// import LoginPage from './pages/LoginPage';
// import CustomerDashboard from './pages/customer/CustomerDashboard';
// // ... other imports ...

// function App() {
//   return (
//     <Routes>

//       {/* Public: Login Page */}
//       <Route path="/" element={
//         <PublicRoute>
//           <LoginPage />
//         </PublicRoute>
//       } />

//       {/* Protected: Customer Dashboard */}
//       <Route path="/customer-dashboard" element={
//         <ProtectedRoute allowedRoles={['CUSTOMER']}>
//           <CustomerDashboard />
//         </ProtectedRoute>
//       } />

//       {/* ... other routes ... */}

//     </Routes>
//   );
// }

// export default App;