import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchAdminDashboard, getCachedAdminDashboard } from "../../api/admin.api";

// Layout & Sections
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminDashboardSkeleton from "../../components/admin/skeletons/AdminDashboardSkeleton";
import AdminHeader from "../../components/admin/sections/AdminHeader";
import AdminFinancialAlert from "../../components/admin/sections/AdminFinancialAlert";
import AdminActivity from "../../components/admin/sections/AdminActivity";
import DailyOperationsSnapshot from "../../components/admin/sections/DailyOperationsSnapshot";
import DeliveryExceptionDashboard from "../../components/admin/sections/DeliveryExceptionDashboard";
import CustomerRiskIndicator from "../../components/admin/sections/CustomerRiskIndicator";
import BulkDeliveryActions from "../../components/admin/sections/BulkDeliveryActions";
import ManualPaymentModal from "../../components/admin/sections/ManualPaymentModal";
import AdminMobileBottomNav from "../../components/admin/layout/AdminMobileBottomNav";
import { adminShellFont } from "../../components/admin/adminTheme";

export default function AdminDashboard() {
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState([]); 
  const [activePayment, setActivePayment] = useState(null); 
  
  // Hydrate from cache immediately
  const initialData = useMemo(() => {
    const cached = getCachedAdminDashboard();
    return cached || {
      dairyName: null,
      stats: { total_milk: 0, procured_milk: 0, pending: 0, collected: 0, failed: 0 },
      exceptions: [],
      suppliers: [],
      riskData: [],
      procurementLogs: []
    };
  }, []);

  const [data, setData] = useState(initialData);
  // uiReady should be true if we have cached data, so the user sees something immediately
  const [uiReady, setUiReady] = useState(Boolean(initialData.suppliers?.length > 0 || initialData.dairyName));

  const adminName = useMemo(() => {
    try {
      const adminUserStr = localStorage.getItem("adminUser");
      return adminUserStr ? JSON.parse(adminUserStr)?.name : "Admin";
    } catch { return "Admin"; }
  }, []);
const loadDashboard = useCallback(async (force = false) => {
  try {
    const res = await fetchAdminDashboard({ forceRefresh: force });
    
    // Debugging: Check your browser console to see what the server actually sent
    console.log("Full Dashboard Response:", res);

    setData({
      dairyName: res.dairyName,
      totalCustomers: res.totalCustomers,
      totalAgents: res.totalAgents,
      activeAgents: res.activeAgents,
      deliveriesToday: res.deliveriesToday,
      // FORCE the update of suppliers
      suppliers: res.suppliers || [], 
      stats: res.stats || { total_milk: 0, procured_milk: 0, pending: 0, collected: 0, failed: 0 },
      exceptions: res.exceptions || [],
      riskData: res.riskData || [],
      procurementLogs: res.procurementLogs || []
    });
    
    setUiReady(true);
  } catch (err) {
    console.error("Dashboard Load Error:", err);
    setError(err.message);
    setUiReady(true);
  }
}, []);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  // Handlers
  const toggleDeliverySelection = (id) => {
    setSelectedDeliveries(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  if (error && !uiReady) {
    return (
      <div className="h-screen flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 p-5 rounded-xl text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#2C1A0E] dark:bg-[#0B0F19] dark:text-white" style={adminShellFont}>
      <AdminMobileTopbar adminName={data?.dairyName || adminName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="px-4 py-8 pb-32 sm:px-6 lg:ml-64 lg:px-10">
        {!uiReady ? (
          <AdminDashboardSkeleton />
        ) : (
          <>
            <AdminHeader adminName={data?.dairyName || adminName} />
            
            <DailyOperationsSnapshot data={data} adminName={data?.dairyName || adminName} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="lg:col-span-2 space-y-8">
                <DeliveryExceptionDashboard 
                  exceptions={data?.exceptions}
                  selectedIds={selectedDeliveries}
                  onToggleSelect={toggleDeliverySelection}
                  onReschedule={(id) => console.log("Rescheduling", id)} 
                />
              </div>

              <div className="space-y-8">
                <AdminFinancialAlert amount={data.stats?.pendingPayments || 0} />
                <CustomerRiskIndicator riskData={data.riskData} />
                <AdminActivity />
              </div>
            </div>
          </>
        )}

        {selectedDeliveries.length > 0 && (
          <BulkDeliveryActions 
            selectedCount={selectedDeliveries.length} 
            onReschedule={() => {
              alert(`Rescheduling ${selectedDeliveries.length} items`);
              setSelectedDeliveries([]);
            }}
            onAssign={() => alert("Assigning Agents...")}
          />
        )}

        {activePayment && (
          <ManualPaymentModal 
            delivery={activePayment} 
            onClose={() => setActivePayment(null)}
            onSave={() => {
              loadDashboard(true);
              setActivePayment(null);
            }}
          />
        )}
      </main>

      <AdminMobileBottomNav />
    </div>
  );
}
