import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

export default function MarketplaceSuccess() {
  const navigate = useNavigate();
  const { state } = useLocation();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF7] px-4 text-[#2C1A0E]">
      <section className="w-full max-w-xl rounded-2xl border border-[#E7DAC6] bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto text-[#4A7C2F]" size={54} />
        <h1 className="mt-4 text-3xl font-black">Payment Successful</h1>
        <p className="mt-2 text-sm text-[#7B6247]">
          The order is paid and the Route transfer has been created for automatic dairy settlement.
        </p>
        <div className="mt-6 rounded-xl bg-[#FFFDF8] p-4 text-left text-sm font-semibold text-[#5C3D1E]">
          <p>Order ID: {state?.orderId || "-"}</p>
          <p>Payment ID: {state?.paymentId || "-"}</p>
          <p>Dairy: {state?.dairyName || "-"}</p>
          <p>Amount: Rs. {state?.amount || "-"}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/marketplace/checkout")}
          className="mt-6 rounded-xl bg-[#B8641A] px-6 py-3 font-black text-white"
        >
          New Payment
        </button>
      </section>
    </main>
  );
}
