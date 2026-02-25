import { useEffect, useMemo, useState } from "react";
import AdminSidebar from "../../components/admin/layout/AdminSidebar";
import AdminMobileTopbar from "../../components/admin/layout/AdminMobileTopbar";

const deliveriesSeed = [
  {
    id: "DLV-1001",
    customerName: "Rahul Sharma",
    agentName: "Aman Singh",
    route: "Green Park",
    quantity: "2L",
    date: "2026-02-25",
    slot: "05:30 AM",
    status: "DELIVERED",
  },
  {
    id: "DLV-1002",
    customerName: "Neha Verma",
    agentName: "Priya Das",
    route: "City Center",
    quantity: "1L",
    date: "2026-02-25",
    slot: "06:00 AM",
    status: "PENDING",
  },
  {
    id: "DLV-1003",
    customerName: "Ramesh Patel",
    agentName: "Aman Singh",
    route: "Sunrise Colony",
    quantity: "3L",
    date: "2026-02-25",
    slot: "07:00 AM",
    status: "FAILED",
  },
  {
    id: "DLV-1004",
    customerName: "Anjali Mehta",
    agentName: "Vikram Rao",
    route: "Lake View",
    quantity: "1.5L",
    date: "2026-02-24",
    slot: "05:45 AM",
    status: "DELIVERED",
  },
  {
    id: "DLV-1005",
    customerName: "Sonia Kapoor",
    agentName: "Priya Das",
    route: "City Center",
    quantity: "2L",
    date: "2026-02-24",
    slot: "06:15 AM",
    status: "DELIVERED",
  },
  {
    id: "DLV-1006",
    customerName: "Karan Malhotra",
    agentName: "Vikram Rao",
    route: "Green Park",
    quantity: "1L",
    date: "2026-02-24",
    slot: "07:10 AM",
    status: "PENDING",
  },
];

const statusStyles = {
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
};

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[status] || "bg-gray-50 text-gray-600 border-gray-200"}`}
    >
      {status}
    </span>
  );
}

export default function AdminDeliveries() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [routeFilter, setRouteFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filterOptions = useMemo(() => {
    const agents = [...new Set(deliveriesSeed.map((d) => d.agentName))].sort();
    const routes = [...new Set(deliveriesSeed.map((d) => d.route))].sort();
    return { agents, routes };
  }, []);

  const filteredAndSortedDeliveries = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = deliveriesSeed.filter((d) => {
      const searchableText = `${d.id} ${d.customerName} ${d.agentName} ${d.route}`.toLowerCase();
      const matchesSearch = !q || searchableText.includes(q);

      const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
      const matchesDate = !dateFilter || d.date === dateFilter;
      const matchesAgent = agentFilter === "ALL" || d.agentName === agentFilter;
      const matchesRoute = routeFilter === "ALL" || d.route === routeFilter;

      return matchesSearch && matchesStatus && matchesDate && matchesAgent && matchesRoute;
    });

    const sorted = [...filtered].sort((a, b) => {
      let compare = 0;

      if (sortBy === "date") {
        compare = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === "customer") {
        compare = a.customerName.localeCompare(b.customerName);
      } else if (sortBy === "agent") {
        compare = a.agentName.localeCompare(b.agentName);
      } else if (sortBy === "status") {
        compare = a.status.localeCompare(b.status);
      } else if (sortBy === "quantity") {
        compare = parseFloat(a.quantity) - parseFloat(b.quantity);
      }

      return sortOrder === "asc" ? compare : -compare;
    });

    return sorted;
  }, [search, statusFilter, dateFilter, agentFilter, routeFilter, sortBy, sortOrder]);

  const totalRecords = filteredAndSortedDeliveries.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter, agentFilter, routeFilter, sortBy, sortOrder, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedDeliveries = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedDeliveries.slice(start, start + pageSize);
  }, [filteredAndSortedDeliveries, page, pageSize]);

  const stats = useMemo(() => {
    const total = filteredAndSortedDeliveries.length;
    const delivered = filteredAndSortedDeliveries.filter((d) => d.status === "DELIVERED").length;
    const pending = filteredAndSortedDeliveries.filter((d) => d.status === "PENDING").length;
    const failed = filteredAndSortedDeliveries.filter((d) => d.status === "FAILED").length;
    return { total, delivered, pending, failed };
  }, [filteredAndSortedDeliveries]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminMobileTopbar title="Deliveries" onMenu={() => setSidebarOpen(true)} />

      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="lg:ml-64 px-4 sm:px-6 lg:px-10 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Deliveries</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track daily fulfillment across agents and routes.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Delivered</p>
            <p className="mt-1 text-2xl font-semibold text-green-700">{stats.delivered}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{stats.pending}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">Failed</p>
            <p className="mt-1 text-2xl font-semibold text-red-700">{stats.failed}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="grid gap-3 border-b px-4 py-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search id, customer, agent, route"
              className="pro-input mt-0"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pro-input mt-0"
            >
              <option value="ALL">All Statuses</option>
              <option value="DELIVERED">Delivered</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>

            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="pro-input mt-0"
            />

            <button
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setDateFilter("");
                setAgentFilter("ALL");
                setRouteFilter("ALL");
                setSortBy("date");
                setSortOrder("desc");
                setPage(1);
                setPageSize(25);
              }}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Reset Filters
            </button>
          </div>

          <div className="grid gap-3 border-b px-4 py-4 sm:px-6 sm:grid-cols-2 lg:grid-cols-5">
            <select
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="pro-input mt-0"
            >
              <option value="ALL">All Agents</option>
              {filterOptions.agents.map((agent) => (
                <option key={agent} value={agent}>
                  {agent}
                </option>
              ))}
            </select>

            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="pro-input mt-0"
            >
              <option value="ALL">All Routes</option>
              {filterOptions.routes.map((route) => (
                <option key={route} value={route}>
                  {route}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="pro-input mt-0"
            >
              <option value="date">Sort by Date</option>
              <option value="customer">Sort by Customer</option>
              <option value="agent">Sort by Agent</option>
              <option value="status">Sort by Status</option>
              <option value="quantity">Sort by Quantity</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="pro-input mt-0"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="pro-input mt-0"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          {paginatedDeliveries.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-gray-500">
              No deliveries match the selected filters.
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Delivery ID</th>
                      <th className="px-6 py-3 font-medium">Customer</th>
                      <th className="px-6 py-3 font-medium">Agent</th>
                      <th className="px-6 py-3 font-medium">Route</th>
                      <th className="px-6 py-3 font-medium">Qty</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Slot</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedDeliveries.map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">{d.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{d.customerName}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{d.agentName}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{d.route}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{d.quantity}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {new Date(d.date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{d.slot}</td>
                        <td className="px-6 py-4">
                          <StatusPill status={d.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 lg:hidden">
                {paginatedDeliveries.map((d) => (
                  <article
                    key={d.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900">{d.id}</p>
                      <StatusPill status={d.status} />
                    </div>

                    <div className="space-y-1 text-sm text-gray-700">
                      <p>
                        <span className="font-medium text-gray-900">Customer:</span> {d.customerName}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Agent:</span> {d.agentName}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Route:</span> {d.route}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Quantity:</span> {d.quantity}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Date:</span>{" "}
                        {new Date(d.date).toLocaleDateString()}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Slot:</span> {d.slot}
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * pageSize + 1}-
                  {Math.min(page * pageSize, totalRecords)} of {totalRecords} deliveries
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
