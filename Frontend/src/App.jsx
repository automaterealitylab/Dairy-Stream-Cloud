import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import ProtectedRoute from "./components/ProtectedRoute"
import AddNewCustomerForm from "./components/AddNewCustomerForm";
import { Route, Routes } from "react-router-dom";
import AddNewAgentForm from "./components/AddNewAgentForm";
import DairyCustomerDashboard from "./components/DairyCustomerDashboard";
import AdminDashboard from "./components/AdminDashboard";
import AgentDashboard from "./components/agentDashboard";
import LoginPage from "./pages/LoginPage";
import RegisterNewuserPage from "./pages/RegisterNewuserPage";
import RegisterDairyPage from "./pages/RegisterDairyPage";
import ExploreDairiesPage from "./pages/public/ExploreDairiesPage";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
function App() {
  return (
    <Routes>
      {/* need to change the route later */}
      <Route path="/" element={<LoginPage></LoginPage>}></Route>

      {/* Public Route */}
      <Route path="/explore" element={<ExploreDairiesPage />} />
      {/* Protected Dashboard Route */}
      <Route
        path="/customer-dashboard"
        element={
          <ProtectedRoute allowedRoles={["CUSTOMER"]}>
            <CustomerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/register"
        element={<RegisterNewuserPage></RegisterNewuserPage>}
      ></Route>

      <Route
        path="/customer-dashboard"
        element={<CustomerDashboard></CustomerDashboard>}
      ></Route>
      <Route
        path="admin/AdminDashboard"
        element={<AdminDashboard></AdminDashboard>}
      ></Route>
      <Route
        path="admin/addCustomer"
        element={<AddNewCustomerForm></AddNewCustomerForm>}
      ></Route>

      <Route
        path="admin/addAgent"
        element={<AddNewAgentForm></AddNewAgentForm>}
      ></Route>
      <Route
        path="/customerDashbord"
        element={<DairyCustomerDashboard></DairyCustomerDashboard>}
      ></Route>
      <Route
        path="agent/AgentDashboard"
        element={<AgentDashboard></AgentDashboard>}
      ></Route>

      <Route
        path="/register-dairy"
        element={<RegisterDairyPage></RegisterDairyPage>}
      ></Route>

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
// import ProtectedRoute from './components/ProtectedRoute'; // <--- Imported
// import PublicRoute from './components/PublicRoute';       // <--- Imported
// import LoginPage from './pages/LoginPage';
// import CustomerDashboard from './components/CustomerDashboard';
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
