import React, { useState, useEffect } from 'react';
import AgentLayout from '../../components/agent/AgentLayout';
import { User, Phone, Mail, MapPin, Award, TrendingUp, Route as RouteIcon, ToggleLeft, ToggleRight } from 'lucide-react';
import { fetchAgentProfile, updateAgentAvailability } from "../../api/agent.api";

const EMPTY_AGENT_PROFILE = {
  agentId: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'ACTIVE',
  isActive: false,
  inactiveFrom: null,
  inactiveUntil: null,
  inactiveDaysRemaining: 0,
  joinedDate: null,
  deliveryRoutes: [],
};

const AgentProfile = () => {
  const [profile, setProfile] = useState(EMPTY_AGENT_PROFILE);
  const [showInactiveDaysInput, setShowInactiveDaysInput] = useState(false);
  const [inactiveDays, setInactiveDays] = useState("1");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusError, setStatusError] = useState("");

  const isActive =
    typeof profile?.isActive === "boolean"
      ? profile.isActive
      : String(profile?.status || "ACTIVE").toUpperCase() !== "INACTIVE";

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setProfile((prev) => ({
          ...prev,
          agentId: user?.agentId || '',
          name: user?.name || '',
          email: user?.email || '',
        }));
      } catch {
        // Ignore malformed local user data.
      }
    }

    const loadProfile = async () => {
      try {
        const payload = await fetchAgentProfile();
        if (payload) setProfile(payload);
      } catch (_err) {
        // Keep local fallback profile values.
      }
    };
    loadProfile();
  }, []);

  const refreshProfileFromServer = async () => {
    const payload = await fetchAgentProfile();
    if (payload) setProfile(payload);
  };

  const handleToggleStatus = async () => {
    if (statusSaving) return;
    setStatusError("");

    if (isActive) {
      setShowInactiveDaysInput(true);
      return;
    }

    try {
      setStatusSaving(true);
      const payload = await updateAgentAvailability({ isActive: true });
      setProfile((prev) => ({
        ...prev,
        isActive: payload?.isActive ?? true,
        status: payload?.status || "ACTIVE",
        inactiveFrom: payload?.inactiveFrom || null,
        inactiveUntil: payload?.inactiveUntil || null,
        inactiveDaysRemaining: payload?.inactiveDaysRemaining || 0,
      }));
      try {
        await refreshProfileFromServer();
      } catch {
        // UI already updated from PATCH response.
      }
      setShowInactiveDaysInput(false);
      setInactiveDays("1");
    } catch (err) {
      setStatusError(err?.response?.data?.message || err?.message || "Failed to update status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const confirmSetInactive = async () => {
    const parsedDays = Number(inactiveDays);
    if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
      setStatusError("Please enter valid inactive days.");
      return;
    }

    try {
      setStatusSaving(true);
      setStatusError("");
      const payload = await updateAgentAvailability({
        isActive: false,
        inactiveDays: parsedDays,
      });
      setProfile((prev) => ({
        ...prev,
        isActive: payload?.isActive ?? false,
        status: payload?.status || "INACTIVE",
        inactiveFrom: payload?.inactiveFrom || null,
        inactiveUntil: payload?.inactiveUntil || null,
        inactiveDaysRemaining: payload?.inactiveDaysRemaining || parsedDays,
      }));
      try {
        await refreshProfileFromServer();
      } catch {
        // UI already updated from PATCH response.
      }
      setShowInactiveDaysInput(false);
    } catch (err) {
      setStatusError(err?.response?.data?.message || err?.message || "Failed to update status.");
    } finally {
      setStatusSaving(false);
    }
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
                    Joined: {profile.joinedDate
                      ? new Date(profile.joinedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Active Status Toggle */}
              <div className="rounded-xl border border-white/40 bg-white/15 p-3 shadow-md backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-white/90">Status</span>
                </div>
                <button
                  onClick={handleToggleStatus}
                  disabled={statusSaving}
                  className="flex min-w-[150px] items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isActive ? (
                    <>
                      <ToggleRight className="text-green-600" size={28} />
                      <span>
                        {statusSaving ? "Updating..." : "Active"}
                      </span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="text-red-500" size={28} />
                      <span>
                        {statusSaving ? "Updating..." : "Inactive"}
                      </span>
                    </>
                  )}
                </button>
                {!isActive && profile?.inactiveUntil && (
                  <p className="mt-2 text-xs text-white/90">
                    Inactive until: {new Date(profile.inactiveUntil).toLocaleDateString()} ({profile?.inactiveDaysRemaining || 0} day(s) left)
                  </p>
                )}
              </div>
            </div>
          </div>

          {showInactiveDaysInput && (
            <div className="border-t border-gray-200 p-4 bg-amber-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Set inactive for how many days?
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={inactiveDays}
                  onChange={(e) => setInactiveDays(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmSetInactive}
                    disabled={statusSaving}
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {statusSaving ? "Saving..." : "Confirm Inactive"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInactiveDaysInput(false);
                      setInactiveDays("1");
                      setStatusError("");
                    }}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {statusError && (
            <div className="px-6 pb-4 text-sm text-red-600">{statusError}</div>
          )}

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
            {profile.deliveryRoutes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600">
                No routes assigned
              </div>
            ) : (
              profile.deliveryRoutes.map((route, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100"
                >
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <p className="text-gray-800">{route}</p>
                </div>
              ))
            )}
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
