import { useEffect, useMemo, useState } from "react";
import { fetchAdminDashboard, getCachedAdminDashboard } from "../../api/admin.api";

// Layout Components
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";
import AdminDashboardSkeleton from "../../components/admin/skeletons/AdminDashboardSkeleton";

// Existing Sections
import AdminHeader from "../../components/admin/sections/AdminHeader";
import AdminKpis from "../../components/admin/sections/AdminKpis";
import AdminFinancialAlert from "../../components/admin/sections/AdminFinancialAlert";
import AdminActivity from "../../components/admin/sections/AdminActivity";

// ✅ NEW OPERATIONAL COMPONENTS
import DailyOperationsSnapshot from "../../components/admin/sections/DailyOperationsSnapshot";
import DeliveryExceptionDashboard from "../../components/admin/sections/DeliveryExceptionDashboard";
import ProcurementTracker from "../../components/admin/sections/ProcurementTracker";
import CustomerRiskIndicator from "../../components/admin/sections/CustomerRiskIndicator";
import BulkDeliveryActions from "../../components/admin/sections/BulkDeliveryActions";
import ManualPaymentModal from "../../components/admin/sections/ManualPaymentModal";

export default function AdminDashboard() {
  // ---- UI state
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDeliveries, setSelectedDeliveries] = useState([]); // ✅ For Bulk Actions
  const [activePayment, setActivePayment] = useState({
  id: "TEMP_ID",
  customer_name: "Test Customer",
  amount_due: 1200
}); // ✅ For Manual Payment

  const cachedDashboard = useMemo(() => getCachedAdminDashboard(), []);
  const [uiReady, setUiReady] = useState(Boolean(cachedDashboard));

  // ---- Admin name (SYNC, SAFE)
  let adminName = "Admin";
  try {
    const adminUserStr = localStorage.getItem("adminUser");
    if (adminUserStr) {
      const parsed = JSON.parse(adminUserStr);
      adminName = parsed?.name || "Admin";
    }
  } catch {
    adminName = "Admin";
  }

  // ---- Dashboard data
  const [data, setData] = useState({
    ...(cachedDashboard || {
      dairyName: null,
      totalCustomers: 0,
      totalAgents: 0,
      activeAgents: 0,
      deliveriesToday: 0,
      pendingPayments: 0,
      // ✅ New Data Fields
      stats: { total_milk: 0, pending: 0, collected: 0, failed: 0 },
      exceptions: [],
      suppliers: [],
      riskData: []
    }),
  });

  const dashboardDisplayName = data?.dairyName || adminName;

  // ---- Fetch dashboard
 // ---- Debug Fetch: Force Mock Data to show UI
  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      try {
        // 1. Try to fetch real data
        const res = await fetchAdminDashboard({ forceRefresh: true });
        
        if (isMounted) {
          // 2. Merge real data with Mock data for missing fields
          setData({
            ...res,
            // If the backend doesn't send these, we force them to exist
            stats: res.stats || { total_milk: 145.5, pending: 12, collected: 8400, failed: 3 },
            exceptions: (res.exceptions && res.exceptions.length > 0) ? res.exceptions : [
              { id: 101, customer_id: 26, quantity_liters: "1.5", notes: "[FAILED_REASON]: CUSTOMER_UNAVAILABLE" },
              { id: 102, customer_id: 42, quantity_liters: "2.0", notes: "[FAILED_REASON]: GATE_LOCKED" }
            ],
            suppliers: (res.suppliers && res.suppliers.length > 0) ? res.suppliers : [
              { id: 1, name: "City Dairy Farm" },
              { id: 2, name: "Green Valley Suppliers" }
            ],
            riskData: (res.riskData && res.riskData.length > 0) ? res.riskData : [
              { name: "Suresh Kumar", failed_payments: 4 },
              { name: "Anita Devi", failed_payments: 2 }
            ]
          });
          setUiReady(true);
        }
      } catch (err) {
        console.error("Fetch failed, using 100% mock data for UI debug");
        if (isMounted) {
          // Fallback to complete mock if server is down
          setData(prev => ({
            ...prev,
            stats: { total_milk: 145.5, pending: 12, collected: 8400, failed: 3 },
            exceptions: [{ id: 101, customer_id: 26, quantity_liters: "1.5", notes: "[FAILED_REASON]: CUSTOMER_UNAVAILABLE" }],
            suppliers: [{ id: 1, name: "City Dairy Farm" }],
            riskData: [{ name: "Suresh Kumar", failed_payments: 4 }]
          }));
          setUiReady(true);
        }
      }
    };

    loadDashboard();
    return () => { isMounted = false; };
  }, []);

  // ---- Error UI
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center px-4">
        <div className="bg-red-50 border border-red-200 p-5 rounded-xl text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar adminName={dashboardDisplayName} onMenu={() => setSidebarOpen(true)} />
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8 pb-32">
        {!uiReady ? (
          <AdminDashboardSkeleton />
        ) : (
          <>
            <AdminHeader adminName={dashboardDisplayName} />
            
            {/* ✅ KPI & DAILY SNAPSHOT SECTION */}
            <DailyOperationsSnapshot stats={data.stats} />
            <AdminKpis data={data} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
              {/* ✅ LEFT COLUMN: LOGISTICS & PROCUREMENT */}
              <div className="lg:col-span-2 space-y-8">
  <DeliveryExceptionDashboard 
    exceptions={data?.exceptions || []}  // ✅ Use Optional Chaining + Fallback
    onReschedule={(id) => console.log("Rescheduling", id)} 
  />
  <ProcurementTracker 
    suppliers={data?.suppliers || []}    // ✅ Use Optional Chaining + Fallback
    onAddLog={(log) => console.log("New Procurement Log", log)} 
  />
</div>

              {/* ✅ RIGHT COLUMN: FINANCIAL ALERTS & RISK */}
              <div className="space-y-8">
                <AdminFinancialAlert amount={data.pendingPayments} />
                <CustomerRiskIndicator riskData={data.riskData} />
                <AdminActivity />
              </div>
            </div>
          </>
        )}

        {/* ✅ OVERLAYS & MODALS */}
        {uiReady && selectedDeliveries.length > 0 && (
          <BulkDeliveryActions 
            selectedCount={selectedDeliveries.length} 
            onReschedule={() => alert("Rescheduling...")}
            onAssign={() => alert("Assigning...")}
          />
        )}

        {activePayment && (
          <ManualPaymentModal 
            delivery={activePayment} 
            onClose={() => setActivePayment(null)}
            onSave={(payData) => {
              console.log("Processing Payment:", payData);
              setActivePayment(null);
            }}
          />
        )}
      </main>
    </div>
  );
}