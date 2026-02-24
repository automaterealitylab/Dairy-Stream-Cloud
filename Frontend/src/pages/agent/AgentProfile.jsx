import React, { useState, useEffect } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import { User, Phone, Mail, MapPin, Award, TrendingUp, Route as RouteIcon, ToggleLeft, ToggleRight } from 'lucide-react';

// Mock data - replace with API
const MOCK_AGENT_PROFILE = {
  agentId: 'AG001',
  name: 'Rajesh Kumar',
  email: 'rajesh.kumar@dairy.com',
  phone: '+91 98765 43210',
  address: 'Narhe, Pune, Maharashtra',
  isActive: true,
  joinedDate: '2025-01-15',
  deliveryRoutes: [
    'Route A: Narhe - Ambegaon - Dhayari',
    'Route B: Kothrud - Karve Nagar',
  ],
  // performanceStats: {
  //   totalDeliveries: 1248,
  //   completedDeliveries: 1180,
  //   failedDeliveries: 68,
  //   successRate: 94.5,
  // },
};

const AgentProfile = () => {
  const [profile, setProfile] = useState(MOCK_AGENT_PROFILE);
  const [isActive, setIsActive] = useState(profile.isActive);

  useEffect(() => {
    // TODO: Fetch agent profile from API
    // fetchAgentProfile().then(setProfile);
  }, []);

  const handleToggleStatus = async () => {
    const newStatus = !isActive;
    setIsActive(newStatus);
    
    // TODO: Update status in API
    // await updateAgentStatus(newStatus);
    
    setProfile(prev => ({ ...prev, isActive: newStatus }));
  };

  // const { performanceStats } = profile;
  // const completionPercentage = (performanceStats.completedDeliveries / performanceStats.totalDeliveries) * 100;
  // const failedPercentage = (performanceStats.failedDeliveries / performanceStats.totalDeliveries) * 100;

  return (
    <AgentLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Agent Profile</h2>
          <p className="text-gray-600">Your profile and performance details</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header Section */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 text-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center border-4 border-white border-opacity-30">
                  <User size={40} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{profile.name}</h3>
                  <p className="text-blue-100">Agent ID: {profile.agentId}</p>
                  <p className="text-sm text-blue-100 mt-1">
                    Joined: {new Date(profile.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Active Status Toggle */}
              <div className="bg-white bg-opacity-20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium">Status</span>
                </div>
                <button
                  onClick={handleToggleStatus}
                  className="flex items-center gap-2"
                >
                  {isActive ? (
                    <>
                      <ToggleRight className="text-green-300" size={32} />
                      <span className="text-sm font-medium">Active</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="text-gray-300" size={32} />
                      <span className="text-sm font-medium">Inactive</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="p-6 space-y-4">
            <h4 className="font-semibold text-gray-800 text-lg mb-4">Contact Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Phone className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Phone Number</p>
                  <p className="font-medium text-gray-800">{profile.phone}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Mail className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Email Address</p>
                  <p className="font-medium text-gray-800">{profile.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 md:col-span-2">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MapPin className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-600">Address</p>
                  <p className="font-medium text-gray-800">{profile.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Routes */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <RouteIcon className="text-blue-600" size={24} />
            <h4 className="font-semibold text-gray-800 text-lg">Assigned Delivery Routes</h4>
          </div>
          <div className="space-y-2">
            {profile.deliveryRoutes.map((route, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
              >
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  {index + 1}
                </div>
                <p className="text-gray-800">{route}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Report */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-green-600" size={24} />
            {/* <h4 className="font-semibold text-gray-800 text-lg">Performance Report</h4> */}
          </div>

          {/* Stats Grid */}
          {/* <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{performanceStats.totalDeliveries}</p>
              <p className="text-sm text-gray-600 mt-1">Total Deliveries</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{performanceStats.completedDeliveries}</p>
              <p className="text-sm text-gray-600 mt-1">Completed</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-600">{performanceStats.failedDeliveries}</p>
              <p className="text-sm text-gray-600 mt-1">Failed</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{performanceStats.successRate}%</p>
              <p className="text-sm text-gray-600 mt-1">Success Rate</p>
            </div>
          </div> */}

          {/* Visual Performance Graph */}
          <div className="space-y-4">
            <h5 className="font-medium text-gray-700">Delivery Distribution</h5>
            
            {/* Completed Bar */}
            <div>
              {/* <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Completed Deliveries</span>
                <span className="text-sm font-semibold text-green-600">
                  {performanceStats.completedDeliveries} ({completionPercentage.toFixed(1)}%)
                </span>
              </div> */}
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                {/* <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-4 transition-all duration-500"
                  style={{ width: `${completionPercentage}%` }}
                /> */}
              </div>
            </div>

            {/* Failed Bar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Failed Deliveries</span>
                {/* <span className="text-sm font-semibold text-red-600">
                  {performanceStats.failedDeliveries} ({failedPercentage.toFixed(1)}%)
                </span> */}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-red-500 to-red-600 h-4 transition-all duration-500"
                  // style={{ width: `${failedPercentage}%` }}
                />
              </div>
            </div>

            {/* Overall Performance Badge */}
            <div className="mt-6 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Award className="text-green-600" size={32} />
                  <div>
                    <p className="font-semibold text-gray-800">Overall Performance</p>
                    <p className="text-sm text-gray-600">Based on all-time deliveries</p>
                  </div>
                </div>
                <div className="text-right">
                  {/* <p className="text-3xl font-bold text-green-600">{performanceStats.successRate}%</p> */}
                  <p className="text-xs text-gray-600">Success Rate</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AgentLayout>
  );
};

export default AgentProfile;
