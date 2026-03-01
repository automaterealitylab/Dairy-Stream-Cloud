import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock3, MapPin, ShoppingBag, CheckCircle2, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import { fetchPublicDairyById } from "../../api/public.api.js";
import {
  cancelCustomerOneTimeOrder,
  createCustomerOneTimeOrder,
  createCustomerPaymentOrder,
  verifyCustomerPayment,
} from "../../api/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";

const toDateInput = (dateValue = new Date()) => {
  const date = new Date(dateValue);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDefaultBuyOnceDate = () => {
  const now = new Date();
  const eveningCutoff = new Date(now);
  eveningCutoff.setHours(16, 0, 0, 0);
  if (now <= eveningCutoff) return toDateInput(now);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateInput(tomorrow);
};

const getDeliverySlotOptions = (deliveryDate) => {
  const now = new Date();
  const todayIso = toDateInput(now);

  const baseSlots = [
    {
      id: "Morning",
      label: "Morning (6:00 AM - 9:00 AM)",
      cutoffHour: 5,
      cutoffMinute: 30,
    },
    {
      id: "Evening",
      label: "Evening (5:00 PM - 8:00 PM)",
      cutoffHour: 16,
      cutoffMinute: 0,
    },
  ];

  if (!deliveryDate) return baseSlots.map((slot) => ({ ...slot, available: false }));

  if (deliveryDate > todayIso) {
    return baseSlots.map((slot) => ({ ...slot, available: true, reason: "Available" }));
  }

  if (deliveryDate < todayIso) {
    return baseSlots.map((slot) => ({
      ...slot,
      available: false,
      reason: "Past date not allowed",
    }));
  }

  return baseSlots.map((slot) => {
    const cutoff = new Date(now);
    cutoff.setHours(slot.cutoffHour, slot.cutoffMinute, 0, 0);
    const available = now <= cutoff;
    return {
      ...slot,
      available,
      reason: available ? "Available today" : "Cut-off passed for today",
    };
  });
};

const normalizeProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || "").trim(),
        ratePerUnit: Number(item.ratePerUnit || 0),
        stockQuantity: Number(item.stockQuantity || 0),
        unit: item.unit || "LITER",
      }))
      .filter((item) => item.name && item.ratePerUnit > 0);
  }

  const legacyProducts = dairy?.products || {
    "Full Cream": 64,
    Toned: 54,
    "Cow Milk": 60,
    "Buffalo Milk": 72,
  };

  return Object.keys(legacyProducts).map((name) => ({
    id: name,
    name,
    ratePerUnit: Number(legacyProducts[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
    unit: "LITER",
  }));
};

const BuyOncePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [dairyRaw, setDairyRaw] = useState(null);
  const [form, setForm] = useState({
    milkType: "",
    quantity: 1,
    deliveryDate: getDefaultBuyOnceDate(),
    slot: "Morning",
    paymentMethod: "PAY_NOW",
    address: "",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchPublicDairyById(id);
        const dairy = res?.dairy || null;
        setDairyRaw(dairy);

        const storedUser = localStorage.getItem("user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            const nextAddress = parsed?.user?.address || parsed?.address || "";
            if (nextAddress) {
              setForm((prev) => ({ ...prev, address: nextAddress }));
            }
          } catch {
            // ignore malformed localStorage
          }
        }
      } catch {
        toast.error("Failed to load dairy details");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const dairy = useMemo(() => {
    if (!dairyRaw) return null;
    return {
      id: dairyRaw.id,
      name: dairyRaw.dairy_name || dairyRaw.name || "Dairy",
      productItems: normalizeProducts(dairyRaw),
    };
  }, [dairyRaw]);

  useEffect(() => {
    if (!dairy) return;
    if (dairy.productItems.some((item) => item.name === form.milkType)) return;
    const firstProduct = dairy.productItems[0]?.name;
    if (firstProduct) {
      setForm((prev) => ({ ...prev, milkType: firstProduct }));
    }
  }, [dairy, form.milkType]);

  const selectedProduct = useMemo(
    () => dairy?.productItems?.find((item) => item.name === form.milkType) || null,
    [dairy, form.milkType]
  );

  const pricePerLiter = useMemo(() => Number(selectedProduct?.ratePerUnit || 0), [selectedProduct]);
  const totalPrice = useMemo(
    () => Number(form.quantity || 0) * pricePerLiter,
    [form.quantity, pricePerLiter]
  );
  const slotOptions = useMemo(() => getDeliverySlotOptions(form.deliveryDate), [form.deliveryDate]);
  const hasAvailableSlot = useMemo(() => slotOptions.some((slot) => slot.available), [slotOptions]);
  const quantity = Number(form.quantity || 0);
  const availableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    const stock = Number(selectedProduct.stockQuantity);
    return Number.isFinite(stock) ? stock : Number.POSITIVE_INFINITY;
  }, [selectedProduct]);
  const isStockLimited = Number.isFinite(availableStock);
  const isOutOfStock = isStockLimited && availableStock <= 0;
  const exceedsStock = isStockLimited && quantity > availableStock;

  useEffect(() => {
    const selected = slotOptions.find((slot) => slot.id === form.slot);
    if (selected?.available) return;
    const firstAvailable = slotOptions.find((slot) => slot.available);
    if (!firstAvailable) return;
    setForm((prev) => ({ ...prev, slot: firstAvailable.id }));
  }, [slotOptions, form.slot]);

  const nextAvailableDate = useMemo(() => {
    if (hasAvailableSlot) return null;
    const base = new Date(`${form.deliveryDate}T00:00:00`);
    if (Number.isNaN(base.getTime())) return null;
    base.setDate(base.getDate() + 1);
    return toDateInput(base);
  }, [hasAvailableSlot, form.deliveryDate]);

  const redirectToLogin = () => {
    navigate("/", { state: { postLoginRedirect: `/buy-once/${id}` } });
  };

  const loadRazorpayCheckoutScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const processOnlinePayment = async (paymentId) => {
    if (!paymentId) {
      throw new Error("Payment reference missing for online payment");
    }

    const scriptLoaded = await loadRazorpayCheckoutScript();
    if (!scriptLoaded) {
      throw new Error("Failed to load payment checkout");
    }

    const orderPayload = await createCustomerPaymentOrder({ paymentId });

    return new Promise((resolve, reject) => {
      const options = {
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: "Dairy Stream",
        description: orderPayload.payment?.title || "One-time Milk Order",
        order_id: orderPayload.order.id,
        handler: async (response) => {
          try {
            await verifyCustomerPayment({
              paymentId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            resolve({ paid: true });
          } catch (err) {
            const verificationError = new Error(
              err?.response?.data?.message || err?.message || "Payment verification failed"
            );
            verificationError.code = "PAYMENT_VERIFY_FAILED";
            reject(verificationError);
          }
        },
        modal: {
          ondismiss: () => resolve({ paid: false, dismissed: true }),
        },
        theme: {
          color: "#2563eb",
        },
      };

      const checkout = new window.Razorpay(options);
      checkout.on("payment.failed", (failedResponse) => {
        const description = failedResponse?.error?.description || "Payment failed";
        resolve({ paid: false, failed: true, reason: description });
      });
      checkout.open();
    });
  };

  const getOrderPaymentId = (response) =>
    response?.payment?.id ||
    response?.paymentId ||
    response?.order?.payment_id ||
    response?.order?.paymentId ||
    response?.order?.payment?.id ||
    null;

  const rollbackCancelledPayNowOrder = async ({ orderId, paymentId }) => {
    if (!orderId || !paymentId) return false;

    try {
      await cancelCustomerOneTimeOrder({ orderId, paymentId });
      return true;
    } catch (err) {
      console.error("Failed to rollback cancelled one-time order:", err);
      return false;
    }
  };

  const handleSubmit = async (allowDuplicate = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Please login to place one-time order");
      redirectToLogin();
      return;
    }

    if (!selectedProduct) {
      toast.error("No product selected");
      return;
    }

    const selectedSlot = slotOptions.find((slot) => slot.id === form.slot);
    if (!selectedSlot?.available) {
      toast.error("Selected slot is not available. Choose another date/slot.");
      return;
    }

    if (!form.address || form.address.trim().length < 10) {
      toast.error("Please enter a detailed delivery address");
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Quantity must be greater than zero");
      return;
    }

    if (isStockLimited && quantity > availableStock) {
      toast.error(`Only ${availableStock} available for ${form.milkType}`);
      return;
    }

    try {
      setSubmitting(true);
      const response = await createCustomerOneTimeOrder({
        dairyId: dairy.id,
        milkType: form.milkType,
        quantity,
        deliveryDate: form.deliveryDate,
        slot: form.slot,
        paymentMethod: form.paymentMethod,
        address: form.address.trim(),
        pricePerLiter,
        allowDuplicate,
      });

      localStorage.setItem("guest_dairy_id", String(dairy.id));
      localStorage.setItem("guest_dairy_name", dairy.name);
      setShowDuplicateConfirm(false);

      if (String(form.paymentMethod).toUpperCase() === "PAY_NOW") {
        const orderId = response?.order?.id || null;
        const paymentId = getOrderPaymentId(response);
        if (!orderId || !paymentId) {
          const rolledBack = await rollbackCancelledPayNowOrder({ orderId, paymentId });
          if (rolledBack) {
            toast.error("Could not start payment. Order was not placed.");
          } else {
            toast.error("Could not start payment. Please check Deliveries/Payments once.");
          }
          return;
        }

        let paymentResult = null;
        try {
          paymentResult = await processOnlinePayment(paymentId);
        } catch (paymentErr) {
          if (paymentErr?.code === "PAYMENT_VERIFY_FAILED") {
            toast.error("Payment received but verification failed. Check Payments page.");
            navigate("/customer/dashboard/payments", {
              state: { from: "buy-once-created", orderId },
            });
            return;
          }

          const rolledBack = await rollbackCancelledPayNowOrder({ orderId, paymentId });
          if (rolledBack) {
            toast.error(paymentErr?.message || "Payment cancelled. Order not placed.");
          } else {
            toast.error("Payment cancelled, but auto-cancel failed. Please contact support.");
          }
          return;
        }

        if (paymentResult?.paid) {
          toast.success("Payment successful. Order confirmed.");
          navigate("/customer/dashboard/deliveries", {
            state: { from: "buy-once-created", orderId },
          });
          return;
        }

        if (paymentResult?.dismissed || paymentResult?.failed) {
          const rolledBack = await rollbackCancelledPayNowOrder({ orderId, paymentId });
          if (rolledBack) {
            toast.error("Payment cancelled. Order not placed.");
          } else {
            toast.error("Payment cancelled, but auto-cancel failed. Please contact support.");
          }
          return;
        }

        const rolledBack = await rollbackCancelledPayNowOrder({ orderId, paymentId });
        if (rolledBack) {
          toast.error("Payment not completed. Order not placed.");
        } else {
          toast.error("Payment not completed, but auto-cancel failed. Please contact support.");
        }
      } else {
        toast.success("One-time order placed. Track status in Deliveries.");
        navigate("/customer/dashboard/deliveries", {
          state: { from: "buy-once-created", orderId: response?.order?.id || null },
        });
      }
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Failed to place one-time order";
      if (!allowDuplicate && /already exists/i.test(message)) {
        setShowDuplicateConfirm(true);
        return;
      }
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !dairy) {
    return <LoadingIndicator fullScreen message="Loading buy once options..." />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-slate-100 transition-colors">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Instant Order</h1>
              <p className="text-xs text-blue-600 font-medium">{dairy?.name}</p>
            </div>
          </div>
          <div className="hidden md:block">
             <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Step 1 of 1: Checkout</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Select Product</h2>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-2 gap-3">
                {dairy.productItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setForm((prev) => ({ ...prev, milkType: item.name }))}
                    className={`relative p-4 rounded-xl border-2 text-left transition-all group ${
                      form.milkType === item.name
                      ? "border-blue-600 bg-blue-50/50 ring-4 ring-blue-50"
                      : "border-slate-100 hover:border-slate-300 bg-white"
                    }`}
                  >
                    {form.milkType === item.name && (
                      <CheckCircle2 size={18} className="absolute top-2 right-2 text-blue-600" />
                    )}
                    <p className={`text-sm font-bold ${form.milkType === item.name ? "text-blue-900" : "text-slate-600"}`}>{item.name}</p>
                    <p className="text-lg font-black text-slate-900 mt-1">Rs {item.ratePerUnit}<span className="text-[10px] text-slate-400 font-normal">/{item.unit}</span></p>
                    <p className={`text-[11px] mt-1 font-medium ${Number(item.stockQuantity || 0) > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      Stock: {Number(item.stockQuantity || 0)}
                    </p>
                  </button>
                ))}
              </div>
              {dairy.productItems.length === 0 && (
                <div className="px-6 pb-6 text-sm text-red-600">No products available in this dairy right now.</div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Delivery Schedule</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Quantity (Liters)</label>
                    <div className="relative">
                      <input
                        type="number" min="0.5" step="0.5"
                        value={form.quantity}
                        onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
                        className="w-full pl-4 pr-12 py-3 rounded-xl border border-slate-200 bg-white text-lg font-bold outline-none focus:border-blue-500 transition-all"
                      />
                      <span className="absolute right-4 top-3.5 text-slate-400 font-bold">Ltr</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date</label>
                    <input
                      type="date" min={toDateInput(new Date())}
                      value={form.deliveryDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-semibold outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                {selectedProduct && (
                  <p className={`text-xs font-semibold ${isOutOfStock || exceedsStock ? "text-red-600" : "text-emerald-600"}`}>
                    Available stock: {Number.isFinite(availableStock) ? availableStock : "Unlimited"}
                  </p>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Time Slot</label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {slotOptions.map((slot) => (
                      <button
                        key={slot.id}
                        disabled={!slot.available}
                        onClick={() => slot.available && setForm((prev) => ({ ...prev, slot: slot.id }))}
                        className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                          form.slot === slot.id && slot.available
                            ? "border-blue-600 bg-blue-50 ring-2 ring-blue-100"
                            : slot.available
                            ? "border-slate-200 hover:border-blue-200 bg-white"
                            : "border-slate-100 bg-slate-50 opacity-60 grayscale cursor-not-allowed"
                        }`}
                      >
                        <Clock3 size={20} className={form.slot === slot.id ? "text-blue-600" : "text-slate-400"} />
                        <div>
                          <p className="font-bold text-sm text-slate-800">{slot.id}</p>
                          <p className="text-[10px] text-slate-500 font-medium">{slot.label}</p>
                          <p className={`text-[10px] mt-1 font-bold ${slot.available ? "text-green-600" : "text-red-500"}`}>{slot.reason}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="lg:w-[380px] space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl sticky top-24">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-400" /> Order Summary
              </h3>

              <div className="space-y-4 border-b border-slate-800 pb-6 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{form.milkType} x {form.quantity}L</span>
                  <span className="font-bold">Rs {totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Delivery Fee</span>
                  <span className="text-green-400 font-bold uppercase text-[10px] bg-green-400/10 px-2 py-1 rounded">Free</span>
                </div>
              </div>

              <div className="flex justify-between items-end mb-8">
                <span className="text-slate-400 text-sm">Grand Total</span>
                <span className="text-3xl font-black">Rs {totalPrice.toFixed(2)}</span>
              </div>

              <div className="space-y-3 mb-8">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                <div className="flex p-1 bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setForm(p => ({...p, paymentMethod: "PAY_NOW"}))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.paymentMethod === "PAY_NOW" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                  >
                    Online
                  </button>
                  <button
                    onClick={() => setForm(p => ({...p, paymentMethod: "COD"}))}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.paymentMethod === "COD" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"}`}
                  >
                    Cash
                  </button>
                </div>
              </div>

              <div className="space-y-2 mb-8">
                <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <MapPin size={10} /> Delivery Address
                </label>
                <textarea
                  rows={2} value={form.address}
                  onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Street, Landmark, City..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 transition-all"
                />
              </div>

              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || !hasAvailableSlot || !selectedProduct || isOutOfStock || exceedsStock || dairy.productItems.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Processing..."
                  : form.paymentMethod === "PAY_NOW"
                  ? "Pay & Place Order"
                  : "Place Order (Cash on Delivery)"}
              </button>
              {(isOutOfStock || exceedsStock) && (
                <p className="mt-2 text-xs text-red-400 font-medium">
                  {isOutOfStock
                    ? `${form.milkType || "Selected product"} is out of stock`
                    : "Requested quantity is more than available stock"}
                </p>
              )}
            </div>

            {!hasAvailableSlot && nextAvailableDate && (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3">
                <Clock3 className="text-amber-600 shrink-0" size={18} />
                <p className="text-[11px] text-amber-800 font-medium">
                  Cut-off reached for today. Next slot opens on <span className="font-bold">{nextAvailableDate}</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showDuplicateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-xl p-6">
            <h3 className="text-lg font-bold text-slate-900">Same Order Found</h3>
            <p className="mt-2 text-sm text-slate-600">
              This is the same order for the selected product/date. Do you want to order again or cancel?
            </p>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDuplicateConfirm(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowDuplicateConfirm(false);
                  handleSubmit(true);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold disabled:bg-slate-400"
              >
                {submitting ? "Ordering..." : "Order Again"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyOncePage;
