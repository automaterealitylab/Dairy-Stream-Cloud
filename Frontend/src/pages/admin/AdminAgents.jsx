import React from 'react';
import { Link } from 'react-router-dom';
import AdminSidebar from "../../components/admin/layout/AdminSidebar.jsx"; // Adjust path if needed

const AdminAgents = () => {
  return (
    <div className="flex">
      <AdminSidebar open={true} />
      <div className="flex-1 p-10 ml-64">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Delivery Agents</h1>
          <Link to="/admin/addagent" className="bg-blue-600 text-white px-4 py-2 rounded">
             + Add Agent
          </Link>
        </div>
        <p>Agent list will appear here.</p>
      </div>
    </div>
  );
};

export default AdminAgents;