import { useEffect, useMemo, useState, useCallback } from "react";
import { fetchAdminDashboard, getCachedAdminDashboard, addProcurementLog } from "../../api/admin.api";
import toast from "react-hot-toast";

// Layout & Sections
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminDashboardSkeleton from "../../components/admin/skeletons/AdminDashboardSkeleton";
import AdminHeader from "../../components/admin/sections/AdminHeader";
import AdminKpis from "../../components/admin/sections/AdminKpis";
import AdminFinancialAlert from "../../components/admin/sections/AdminFinancialAlert";
import AdminActivity from "../../components/admin/sections/AdminActivity";
import DailyOperationsSnapshot from "../../components/admin/sections/DailyOperationsSnapshot";
import DeliveryExceptionDashboard from "../../components/admin/sections/DeliveryExceptionDashboard";
import ProcurementTracker from "../../components/admin/sections/ProcurementTracker";
import CustomerRiskIndicator from "../../components/admin/sections/CustomerRiskIndicator";
import BulkDeliveryActions from "../../components/admin/sections/BulkDeliveryActions";
import ManualPaymentModal from "../../components/admin/sections/ManualPaymentModal";

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
      riskData: []
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
      riskData: res.riskData || []
    });
    
    setUiReady(true);
  } catch (err) {
    console.error("Dashboard Load Error:", err);
    setError(err.message);
    setUiReady(true);
  }
}, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Handlers
  const handleAddProcurement = async (logData) => {
    try {
      // Ensure the log data uses 'supplier_id' to match your Supabase schema
      await addProcurementLog(logData);
      toast.success("Log added successfully!");
      // Refresh to update the Milk Procured card and history
      loadDashboard(true); 
    } catch (err) {
      toast.error("Failed to add log");
    }
  };

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
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar adminName={data?.dairyName || adminName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8 pb-32">
        {!uiReady ? (
          <AdminDashboardSkeleton />
        ) : (
          <>
            <AdminHeader adminName={data?.dairyName || adminName} />
            
            <DailyOperationsSnapshot stats={data.stats} />
            <AdminKpis data={data} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              <div className="lg:col-span-2 space-y-8">
                <DeliveryExceptionDashboard 
                  exceptions={data?.exceptions}
                  selectedIds={selectedDeliveries}
                  onToggleSelect={toggleDeliverySelection}
                  onReschedule={(id) => console.log("Rescheduling", id)} 
                />
                
                <ProcurementTracker 
                  suppliers={data?.suppliers} 
                  onAddLog={handleAddProcurement} 
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
    </div>
  );
}