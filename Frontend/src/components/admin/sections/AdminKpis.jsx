import StatCard from "../StatCard";
import { memo } from "react";

const AdminKpis = memo(function AdminKpis({ data }) {
  return (
    <section className="mb-14">
      <div className="flex overflow-x-auto flex-nowrap scrollbar-none snap-x snap-mandatory gap-6 pb-4 sm:pb-0 sm:grid sm:grid-cols-2 xl:grid-cols-4 sm:overflow-visible">
        <StatCard label="Customers" value={data.totalCustomers} />
        <StatCard label="Active Agents" value={`${data.activeAgents}/${data.totalAgents}`} />
        <StatCard label="Deliveries Today" value={data.deliveriesToday} />
        <StatCard label="Pending Payments" value={`₹${data.pendingPayments}`} />
      </div>
    </section>
  );
  
}
)
export default AdminKpis;
