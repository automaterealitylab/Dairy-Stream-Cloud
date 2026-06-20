import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, BarChart3, Building2, CreditCard, GitCompareArrows, RefreshCw, ShieldAlert, Webhook } from "lucide-react";
import {
  fetchMarketplaceAdminDashboard,
  fetchMarketplaceMonitoring,
} from "../../api/marketplace.api";

const Table = ({ title, rows, columns }) => (
  <section className="rounded-2xl border border-[#E7DAC6] bg-white p-5 shadow-sm">
    <h2 className="text-lg font-black text-[#2C1A0E]">{title}</h2>
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-[#8B7355]">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-[#EFE4D5] px-3 py-2">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((row, index) => (
            <tr key={row.id || index} className="border-b border-[#F5EEE5]">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-3 font-semibold text-[#5C3D1E]">
                  {column.render ? column.render(row) : row[column.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default function MarketplaceAdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState({ dairies: [], orders: [], payments: [], webhookLogs: [] });
  const [monitoring, setMonitoring] = useState(null);

  useEffect(() => {
    Promise.all([fetchMarketplaceAdminDashboard(), fetchMarketplaceMonitoring()])
      .then(([dashboardPayload, monitoringPayload]) => {
        setData(dashboardPayload || {});
        setMonitoring(monitoringPayload || null);
      })
      .catch((err) => toast.error(err.response?.data?.error || "Failed to load admin dashboard"));
  }, []);

  const totalPaid = (data.payments || [])
    .filter((payment) => String(payment.status).toUpperCase() === "PAID")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <main className="min-h-screen bg-[#FAFAF7] px-4 py-6 text-[#2C1A0E]">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B8641A]">Marketplace Admin</p>
            <h1 className="mt-2 text-3xl font-black">Route Transactions</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate("/marketplace/checkout")}
            className="rounded-xl bg-[#B8641A] px-5 py-3 font-black text-white"
          >
            Customer Checkout
          </button>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Dairies", value: data.dairies?.length || 0, icon: Building2 },
            { label: "Orders", value: data.orders?.length || 0, icon: BarChart3 },
            { label: "Payments", value: data.payments?.length || 0, icon: CreditCard },
            { label: "Paid Amount", value: `Rs. ${totalPaid.toFixed(2)}`, icon: Webhook },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#E7DAC6] bg-white p-5 shadow-sm">
              <item.icon className="text-[#B8641A]" size={22} />
              <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">{item.label}</p>
              <p className="mt-1 text-2xl font-black">{item.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Payment Success", value: `${monitoring?.paymentSuccessRate ?? 0}%`, icon: CreditCard },
            { label: "Transfer Success", value: `${monitoring?.transferSuccessRate ?? 0}%`, icon: GitCompareArrows },
            { label: "Settlement Delays", value: monitoring?.settlementDelays ?? 0, icon: RefreshCw },
            { label: "Fraud Alerts", value: monitoring?.fraudAlerts ?? data.fraudAlerts?.length ?? 0, icon: ShieldAlert },
            { label: "Webhook Failures", value: monitoring?.webhookFailures ?? 0, icon: Webhook },
            { label: "Failed Transfers", value: monitoring?.failedTransfers ?? 0, icon: AlertTriangle },
            { label: "Dead Letters", value: monitoring?.deadLetters ?? 0, icon: AlertTriangle },
            { label: "Open Mismatches", value: monitoring?.reconciliationMismatches ?? data.reconciliationMismatches?.length ?? 0, icon: GitCompareArrows },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#E7DAC6] bg-white p-5 shadow-sm">
              <item.icon className="text-[#8B2F2F]" size={22} />
              <p className="mt-3 text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">{item.label}</p>
              <p className="mt-1 text-2xl font-black">{item.value}</p>
            </div>
          ))}
        </section>

        <Table
          title="Queue Status"
          rows={monitoring?.queues?.queues || []}
          columns={[
            { key: "name", label: "Queue" },
            { key: "waiting", label: "Waiting", render: (row) => row.counts?.waiting ?? 0 },
            { key: "active", label: "Active", render: (row) => row.counts?.active ?? 0 },
            { key: "failed", label: "Failed", render: (row) => row.counts?.failed ?? 0 },
            { key: "delayed", label: "Delayed", render: (row) => row.counts?.delayed ?? 0 },
          ]}
        />

        <Table
          title="Unresolved Reconciliation Mismatches"
          rows={monitoring?.reconciliation?.unresolvedMismatches || data.reconciliationMismatches}
          columns={[
            { key: "id", label: "ID" },
            { key: "mismatch_type", label: "Type" },
            { key: "severity", label: "Severity" },
            { key: "payment_id", label: "Payment" },
            { key: "last_seen_at", label: "Last Seen" },
          ]}
        />

        <Table
          title="Fraud Alerts"
          rows={data.fraudAlerts}
          columns={[
            { key: "id", label: "ID" },
            { key: "alert_type", label: "Type" },
            { key: "severity", label: "Severity" },
            { key: "status", label: "Status" },
            { key: "created_at", label: "Created" },
          ]}
        />

        <Table
          title="All Dairies"
          rows={data.dairies}
          columns={[
            { key: "id", label: "ID" },
            { key: "dairy_name", label: "Dairy" },
            { key: "owner_name", label: "Owner" },
            { key: "razorpay_account_id", label: "Linked Account" },
            { key: "route_activation_status", label: "Route Status" },
          ]}
        />

        <Table
          title="Orders"
          rows={data.orders}
          columns={[
            { key: "id", label: "ID" },
            { key: "dairy_id", label: "Dairy" },
            { key: "amount", label: "Amount" },
            { key: "payment_status", label: "Payment" },
            { key: "razorpay_order_id", label: "Razorpay Order" },
          ]}
        />

        <Table
          title="Payments"
          rows={data.payments}
          columns={[
            { key: "id", label: "ID" },
            { key: "order_id", label: "Order" },
            { key: "amount", label: "Amount" },
            { key: "status", label: "Payment" },
            { key: "settlement_status", label: "Settlement" },
            { key: "razorpay_transfer_id", label: "Transfer" },
          ]}
        />

        <Table
          title="Webhook Logs"
          rows={data.webhookLogs}
          columns={[
            { key: "id", label: "ID" },
            { key: "event_type", label: "Event" },
            { key: "created_at", label: "Created" },
          ]}
        />
      </div>
    </main>
  );
}
