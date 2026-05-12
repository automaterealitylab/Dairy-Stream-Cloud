import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Building2, CreditCard } from "lucide-react";
import { fetchMarketplaceDairyDashboard } from "../../api/marketplace.api";

export default function MarketplaceDairyDashboard() {
  const { dairyId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState({ dairy: null, orders: [], payments: [] });

  useEffect(() => {
    fetchMarketplaceDairyDashboard(dairyId)
      .then((payload) => setData(payload || {}))
      .catch((err) => toast.error(err.response?.data?.error || "Failed to load dairy dashboard"));
  }, [dairyId]);

  const paidAmount = (data.payments || [])
    .filter((payment) => String(payment.status).toUpperCase() === "PAID")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <main className="min-h-screen bg-[#FAFAF7] px-4 py-6 text-[#2C1A0E]">
      <div className="mx-auto max-w-6xl">
        <button
          type="button"
          onClick={() => navigate("/marketplace/checkout")}
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-[#E7DAC6] bg-white px-4 py-2 text-sm font-bold text-[#7B6247]"
        >
          <ArrowLeft size={16} />
          Checkout
        </button>

        <section className="rounded-2xl border border-[#E7DAC6] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#FFF3E2] p-3 text-[#B8641A]">
              <Building2 size={26} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B8641A]">Dairy Dashboard</p>
              <h1 className="text-3xl font-black">{data.dairy?.dairy_name || "Dairy"}</h1>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-[#FFFDF8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8B7355]">Linked Account</p>
              <p className="mt-1 font-black">{data.dairy?.razorpay_account_id || "-"}</p>
            </div>
            <div className="rounded-xl bg-[#FFFDF8] p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8B7355]">Route Status</p>
              <p className="mt-1 font-black">{data.dairy?.route_activation_status || "-"}</p>
            </div>
            <div className="rounded-xl bg-[#EEF7EB] p-4">
              <CreditCard className="text-[#4A7C2F]" size={20} />
              <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-[#6F8C45]">Paid Amount</p>
              <p className="mt-1 text-2xl font-black">Rs. {paidAmount.toFixed(2)}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-[#E7DAC6] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black">Recent Payments</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.14em] text-[#8B7355]">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Settlement</th>
                  <th className="px-3 py-2">Transfer</th>
                </tr>
              </thead>
              <tbody>
                {(data.payments || []).map((payment) => (
                  <tr key={payment.id} className="border-t border-[#F5EEE5]">
                    <td className="px-3 py-3 font-semibold">{payment.order_id}</td>
                    <td className="px-3 py-3 font-semibold">Rs. {payment.amount}</td>
                    <td className="px-3 py-3 font-semibold">{payment.status}</td>
                    <td className="px-3 py-3 font-semibold">{payment.settlement_status}</td>
                    <td className="px-3 py-3 font-semibold">{payment.razorpay_transfer_id || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
