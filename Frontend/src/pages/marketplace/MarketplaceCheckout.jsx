import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Building2, CreditCard, Loader2, Plus } from "lucide-react";
import {
  createMarketplaceOrder,
  fetchMarketplaceDairies,
  fetchMarketplaceProducts,
  verifyMarketplacePayment,
} from "../../api/marketplace.api";
import { loadRazorpayCheckout } from "../../utils/loadRazorpay";

export default function MarketplaceCheckout() {
  const navigate = useNavigate();
  const [dairies, setDairies] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [form, setForm] = useState({
    dairy_id: "",
    product_id: "",
    quantity: "1",
    customer_name: "",
    customer_phone: "",
    customer_address: "",
  });

  useEffect(() => {
    let active = true;
    fetchMarketplaceDairies()
      .then((rows) => {
        if (!active) return;
        setDairies(rows || []);
        const firstPayableDairy = rows?.find((dairy) => dairy.payments_enabled);
        if (firstPayableDairy?.id) {
          setForm((prev) => ({ ...prev, dairy_id: String(firstPayableDairy.id) }));
        }
      })
      .catch((err) => toast.error(err.response?.data?.error || "Failed to load dairies"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  useEffect(() => {
    if (!form.dairy_id) {
      setProducts([]);
      return;
    }

    let active = true;
    setProductsLoading(true);
    fetchMarketplaceProducts(form.dairy_id)
      .then((rows) => {
        if (!active) return;
        setProducts(rows || []);
        setForm((prev) => ({
          ...prev,
          product_id: rows?.[0]?.id ? String(rows[0].id) : "",
        }));
      })
      .catch((err) => toast.error(err.response?.data?.error || "Failed to load products"))
      .finally(() => active && setProductsLoading(false));

    return () => {
      active = false;
    };
  }, [form.dairy_id]);

  const startPayment = async (event) => {
    event.preventDefault();
    setPaying(true);
    try {
      const loaded = await loadRazorpayCheckout();
      if (!loaded) throw new Error("Could not load Razorpay Checkout");

      const selectedProduct = products.find((product) => String(product.id) === String(form.product_id));
      if (!selectedProduct) throw new Error("Select an available product");

      const response = await createMarketplaceOrder({
        dairy_id: form.dairy_id,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_address: form.customer_address,
        items: [
          {
            product_id: form.product_id,
            quantity: Number(form.quantity || 1),
          },
        ],
      });
      const order = response.order;

      const checkout = new window.Razorpay({
        key: response.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "Dairy Vision Marketplace",
        description: "Milk and dairy products",
        order_id: order.id,
        prefill: {
          name: form.customer_name,
          contact: form.customer_phone,
        },
        notes: {
          dairy_id: form.dairy_id,
          local_order_id: response.orderRow?.id,
        },
        handler: async (paymentResponse) => {
          await verifyMarketplacePayment({
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
          });
          navigate("/marketplace/success", {
            state: {
              orderId: response.orderRow?.id,
              paymentId: paymentResponse.razorpay_payment_id,
              dairyName: response.dairy?.dairy_name,
              amount: response.pricing?.total,
            },
          });
        },
        theme: { color: "#B8641A" },
      });

      checkout.on("payment.failed", (failure) => {
        toast.error(failure?.error?.description || "Payment failed");
      });
      checkout.open();
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Unable to start payment");
    } finally {
      setPaying(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAF7] px-4 py-6 text-[#2C1A0E]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate("/marketplace/dairy/register")}
            className="inline-flex items-center gap-2 rounded-lg bg-[#B8641A] px-4 py-2 text-sm font-bold text-white"
          >
            <Plus size={16} />
            Register Dairy
          </button>
          <button
            type="button"
            onClick={() => navigate("/marketplace/admin")}
            className="rounded-lg border border-[#E7DAC6] bg-white px-4 py-2 text-sm font-bold text-[#7B6247]"
          >
            Admin Dashboard
          </button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[#E7DAC6] bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#B8641A]">Customer Checkout</p>
            <h1 className="mt-2 text-3xl font-black">Pay Dairy Directly</h1>
            <p className="mt-2 text-sm text-[#7B6247]">
              Razorpay Route creates the transfer on the order so the full amount settles to the dairy linked account.
            </p>

            <form onSubmit={startPayment} className="mt-7 space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">Dairy</span>
                <select
                  value={form.dairy_id}
                  onChange={(event) => setField("dairy_id", event.target.value)}
                  disabled={loading}
                  className="mt-2 w-full rounded-lg border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#B8641A]"
                >
                  {dairies.map((dairy) => (
                    <option key={dairy.id} value={dairy.id} disabled={!dairy.payments_enabled}>
                      {dairy.dairy_name} {dairy.payments_enabled ? "" : "(payments not active)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">Product</span>
                <select
                  value={form.product_id}
                  onChange={(event) => setField("product_id", event.target.value)}
                  disabled={productsLoading || products.length === 0}
                  className="mt-2 w-full rounded-lg border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#B8641A]"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - Rs. {Number(product.rate_per_unit || 0).toFixed(2)} / {product.unit || "unit"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">Quantity</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.quantity}
                  onChange={(event) => setField("quantity", event.target.value)}
                  className="mt-2 w-full rounded-lg border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#B8641A]"
                />
              </label>

              {["customer_name", "customer_phone", "customer_address"].map((field) => (
                <label key={field} className="block">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-[#8B7355]">
                    {field.replaceAll("_", " ")}
                  </span>
                  <input
                    type="text"
                    value={form[field]}
                    onChange={(event) => setField(field, event.target.value)}
                    className="mt-2 w-full rounded-lg border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#B8641A]"
                  />
                </label>
              ))}

              <button
                type="submit"
                disabled={
                  paying ||
                  !form.dairy_id ||
                  !form.product_id ||
                  !dairies.find((dairy) => String(dairy.id) === String(form.dairy_id))?.payments_enabled
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#4A7C2F] px-6 py-4 font-black text-white transition hover:bg-[#3E6928] disabled:bg-[#BFD4AF]"
              >
                {paying ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                Pay With Razorpay
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-[#E7DAC6] bg-[#FFFDF8] p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[#FFF3E2] p-3 text-[#B8641A]">
                <Building2 size={22} />
              </div>
              <div>
                <h2 className="font-black">Marketplace Settlement</h2>
                <p className="text-sm text-[#7B6247]">Customer to dairy owner bank account</p>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm font-semibold text-[#5C3D1E]">
              <p>1. Customer pays in Razorpay Checkout.</p>
              <p>2. Order contains one transfer for 100% of amount.</p>
              <p>3. Transfer recipient is the dairy linked account.</p>
              <p>4. No RazorpayX payout or manual transfer is used.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
