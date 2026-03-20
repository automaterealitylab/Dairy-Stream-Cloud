import StatCard from "../StatCard";
import { memo } from "react";

const AdminKpis = memo(function AdminKpis({ data }) {
  return (
    <section className="mb-14">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
