import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Clock3, MapPin, ShoppingBag, CheckCircle2, CreditCard, Plus, Minus } from "lucide-react";
import toast from "react-hot-toast";
import { fetchPublicDairyById } from "../../api/public.api.js";
import {
  cancelCustomerOneTimeOrder,
  createCustomerOneTimeOrder,
  createCustomerPaymentOrder,
  fetchCustomerProfile,
  fetchCustomerSubscription,
  verifyCustomerPayment,
} from "../../api/customer/customer.api.js";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import { buildCustomerAddress } from "../../utils/customerAddress.js";

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

const getTomorrowBuyOnceDate = () => {
  const tomorrow = new Date();
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

const deriveProductType = (type, name) => {
  const t = String(type || "").trim().toUpperCase();
  if (t && t !== "OTHER" && ["MILK", "CURD", "PANEER", "GHEE"].includes(t)) {
    return t;
  }
  const n = String(name || "").toLowerCase();
  if (n.includes("milk")) return "MILK";
  if (n.includes("curd") || n.includes("dahi") || n.includes("yogurt")) return "CURD";
  if (n.includes("paneer") || n.includes("panner") || n.includes("cheese")) return "PANEER";
  if (n.includes("ghee") || n.includes("butter")) return "GHEE";
  return "OTHER";
};

const normalizeProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || "").trim(),
        type: deriveProductType(item.type || item.product_type, item.name),
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
    type: deriveProductType("MILK", name),
    ratePerUnit: Number(legacyProducts[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
    unit: "LITER",
  }));
};

const isProductOutOfStock = (stockQuantity) => {
  const stock = Number(stockQuantity);
  return Number.isFinite(stock) && stock <= 0;
};

const formatProductStockLabel = (stockQuantity) => {
  const stock = Number(stockQuantity);
  if (!Number.isFinite(stock)) return "Unlimited";
  if (stock <= 0) return "Out of Stock";
  return String(stock);
};

const hasOpenSubscriptionStatus = (status) => {
  const value = String(status || "ACTIVE").trim().toUpperCase();
  return value !== "CLOSED" && value !== "CANCELLED" && value !== "CANCELED";
};

const getProductImage = (type) => {
  const t = String(type || "").toUpperCase();
  switch (t) {
    case "MILK":
      return <img src="/images/products/milk.png" alt="Milk" className="h-full w-full object-contain" />;
    case "CURD":
      return <img src="/images/products/curd.png" alt="Curd" className="h-full w-full object-contain" />;
    case "PANEER":
      return <img src="/images/products/paneer.png" alt="Paneer" className="h-full w-full object-contain" />;
    case "GHEE":
      return <img src="/images/products/ghee.png" alt="Ghee" className="h-full w-full object-contain" />;
    default:
      return <img src="/images/products/other.png" alt="Other" className="h-full w-full object-contain" />;
  }
};

const BuyOncePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isCustomerExtraFlow = location.state?.from === "customer-add-extra";
  const nextDayDeliveryDate =
    typeof location.state?.deliveryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(location.state.deliveryDate)
      ? location.state.deliveryDate
      : getTomorrowBuyOnceDate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [dairyRaw, setDairyRaw] = useState(null);
  const [hasSubscriptionForThisDairy, setHasSubscriptionForThisDairy] = useState(false);
  const [form, setForm] = useState({
    milkType: "",
    items: {},
    deliveryDate: isCustomerExtraFlow ? nextDayDeliveryDate : getDefaultBuyOnceDate(),
    slot: "Morning",
    paymentMethod: "PAY_NOW",
    address: "",
  });

  useEffect(() => {
    if (!isCustomerExtraFlow) return;

    setForm((prev) => ({
      ...prev,
      deliveryDate: nextDayDeliveryDate,
    }));
  }, [isCustomerExtraFlow, nextDayDeliveryDate]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await fetchPublicDairyById(id);
        const dairy = res?.dairy || null;
        setDairyRaw(dairy);

        const token = localStorage.getItem("token");
        if (token) {
          try {
            const subRes = await fetchCustomerSubscription();
            const activeSubscription = subRes?.subscription || null;
            const isBlocked =
              activeSubscription &&
              hasOpenSubscriptionStatus(activeSubscription.status) &&
              String(activeSubscription.dairy_id) === String(id);
            setHasSubscriptionForThisDairy(Boolean(isBlocked));
          } catch {
            setHasSubscriptionForThisDairy(false);
          }

          try {
            const profile = await fetchCustomerProfile();
            const nextAddress = buildCustomerAddress(profile);
            if (nextAddress) {
              setForm((prev) => ({ ...prev, address: nextAddress }));
            }
          } catch {
            const storedUser = localStorage.getItem("user");
            if (storedUser) {
              try {
                const parsed = JSON.parse(storedUser);
                const nextAddress = buildCustomerAddress(parsed?.user || parsed || {});
                if (nextAddress) {
                  setForm((prev) => ({ ...prev, address: nextAddress }));
                }
              } catch {
                // ignore malformed localStorage
              }
            }
          }
        } else {
          setHasSubscriptionForThisDairy(false);
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
    if (dairy.productItems.some((item) => item.name === form.milkType) && Object.keys(form.items || {}).length > 0) return;
    const firstInStock = dairy.productItems.find((item) => !isProductOutOfStock(item.stockQuantity))?.name;
    const firstProduct = firstInStock || dairy.productItems[0]?.name;
    if (firstProduct) {
      setForm((prev) => ({
        ...prev,
        milkType: firstProduct,
        items:
          Object.keys(prev.items || {}).length > 0
            ? prev.items
            : {
                [firstProduct]: 1,
              },
      }));
    }
  }, [dairy, form.milkType, form.items]);

  const selectedProduct = useMemo(
    () => dairy?.productItems?.find((item) => item.name === form.milkType) || null,
    [dairy, form.milkType]
  );

  const selectedItems = useMemo(
    () =>
      (dairy?.productItems || [])
        .map((item) => ({
          ...item,
          quantity: Number(form.items?.[item.name] || 0),
        }))
        .filter((item) => item.quantity > 0),
    [dairy, form.items]
  );

  const totalPrice = useMemo(
    () =>
      selectedItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.ratePerUnit || 0),
        0
      ),
    [selectedItems]
  );
  const slotOptions = useMemo(() => getDeliverySlotOptions(form.deliveryDate), [form.deliveryDate]);
  const hasAvailableSlot = useMemo(() => slotOptions.some((slot) => slot.available), [slotOptions]);
  const availableStock = useMemo(() => {
    if (!selectedProduct) return 0;
    const stock = Number(selectedProduct.stockQuantity);
    return Number.isFinite(stock) ? stock : Number.POSITIVE_INFINITY;
  }, [selectedProduct]);
  const isStockLimited = Number.isFinite(availableStock);
  const isOutOfStock = isStockLimited && availableStock <= 0;
  const activeQuantity = Number(form.items?.[form.milkType] || 0);
  const exceedsStock = isStockLimited && activeQuantity > availableStock;
  const invalidStockItem = useMemo(
    () =>
      selectedItems.find((item) => {
        const stock = Number(item.stockQuantity);
        return Number.isFinite(stock) && item.quantity > stock;
      }) || null,
    [selectedItems]
  );

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
    navigate("/", {
      state: {
        postLoginRedirect: `/buy-once/${id}`,
        postLoginState: isCustomerExtraFlow
          ? {
              from: "customer-add-extra",
              dairyId: location.state?.dairyId || id,
              dairyName: location.state?.dairyName || "",
              deliveryDate: nextDayDeliveryDate,
            }
          : null,
      },
    });
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
        name: "Dairy Vision",
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

  const toggleProductSelection = (productName) => {
    setForm((prev) => {
      const nextItems = { ...(prev.items || {}) };
      if (Number(nextItems[productName] || 0) > 0) {
        delete nextItems[productName];
      } else {
        nextItems[productName] = 1;
      }

      const remainingKeys = Object.keys(nextItems);
      return {
        ...prev,
        milkType: remainingKeys.includes(prev.milkType) ? prev.milkType : remainingKeys[0] || productName,
        items: nextItems,
      };
    });
  };

  const updateSelectedItemQuantity = (productName, nextValue) => {
    const quantity = Number(nextValue);
    setForm((prev) => {
      const nextItems = { ...(prev.items || {}) };
      if (!Number.isFinite(quantity) || quantity <= 0) {
        delete nextItems[productName];
      } else {
        nextItems[productName] = quantity;
      }

      const remainingKeys = Object.keys(nextItems);
      return {
        ...prev,
        milkType: remainingKeys.includes(prev.milkType) ? prev.milkType : remainingKeys[0] || "",
        items: nextItems,
      };
    });
  };

  const rollbackCancelledPayNowOrder = async ({ orderId, orderIds, paymentId }) => {
    if ((!orderId && (!Array.isArray(orderIds) || orderIds.length === 0)) || !paymentId) return false;

    try {
      await cancelCustomerOneTimeOrder({ orderId, orderIds, paymentId, removeFromHistory: true });
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

    if (!selectedItems.length) {
      toast.error("Select at least one product");
      return;
    }
    if (hasSubscriptionForThisDairy && !isCustomerExtraFlow) {
      toast.error("You already have an active subscription with this dairy.");
      return;
    }

    if (isCustomerExtraFlow && form.deliveryDate !== nextDayDeliveryDate) {
      toast.error("Extra products can only be ordered for tomorrow's delivery.");
      setForm((prev) => ({ ...prev, deliveryDate: nextDayDeliveryDate }));
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

    if (invalidStockItem) {
      toast.error(`Only ${invalidStockItem.stockQuantity} available for ${invalidStockItem.name}`);
      return;
    }

    try {
      setSubmitting(true);
      const response = await createCustomerOneTimeOrder({
        dairyId: dairy.id,
        items: selectedItems.map((item) => ({
          milkType: item.name,
          quantity: item.quantity,
        })),
        deliveryDate: form.deliveryDate,
        slot: form.slot,
        paymentMethod: "PAY_NOW",
        address: form.address.trim(),
        isExtraOrder: isCustomerExtraFlow,
        allowDuplicate,
      });

      localStorage.setItem("guest_dairy_id", String(dairy.id));
      localStorage.setItem("guest_dairy_name", dairy.name);
      setShowDuplicateConfirm(false);

      const orderIds = Array.isArray(response?.orderIds) ? response.orderIds : [];
      const orderId = response?.order?.id || orderIds[0] || null;
      const paymentId = getOrderPaymentId(response);
      if (!orderId || !paymentId) {
        const rolledBack = await rollbackCancelledPayNowOrder({ orderId, orderIds, paymentId });
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

        const rolledBack = await rollbackCancelledPayNowOrder({ orderId, orderIds, paymentId });
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
        const rolledBack = await rollbackCancelledPayNowOrder({ orderId, orderIds, paymentId });
        if (rolledBack) {
          toast.error("Payment cancelled. Order not placed.");
        } else {
          toast.error("Payment cancelled, but auto-cancel failed. Please contact support.");
        }
        return;
      }

      const rolledBack = await rollbackCancelledPayNowOrder({ orderId, orderIds, paymentId });
      if (rolledBack) {
        toast.error("Payment not completed. Order not placed.");
      } else {
        toast.error("Payment not completed, but auto-cancel failed. Please contact support.");
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
            <button
              onClick={() => navigate(isCustomerExtraFlow ? "/customer/dashboard" : -1)}
              className="p-2 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {isCustomerExtraFlow ? "Add Extra For Tomorrow" : "Instant Order"}
              </h1>
              <p className="text-xs text-blue-600 font-medium">{dairy?.name}</p>
            </div>
          </div>
          <div className="hidden md:block">
             <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
               {isCustomerExtraFlow ? "Next-Day Extra Order" : "Step 1 of 1: Checkout"}
             </span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-6">
            {hasSubscriptionForThisDairy && !isCustomerExtraFlow && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
                You already have an active subscription with {dairy.name}. One-time delivery is not available for this dairy.
              </div>
            )}

            {isCustomerExtraFlow && (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
                <p className="font-semibold">Add extra products for tomorrow&apos;s delivery.</p>
                <p className="mt-1 text-xs text-blue-700">
                  Your request will appear in your delivery history and in the dairy owner&apos;s approval queue.
                </p>
              </div>
            )}

            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                <ShoppingBag size={18} className="text-blue-600" />
                <h2 className="text-sm font-bold text-slate-700 uppercase tracking-tight">Select Products</h2>
              </div>
              <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {dairy.productItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isProductOutOfStock(item.stockQuantity)}
                    onClick={() => {
                      setForm((prev) => ({ ...prev, milkType: item.name }));
                      toggleProductSelection(item.name);
                    }}
                    className={`relative p-3 rounded-xl border-2 text-left transition-all group flex flex-col sm:flex-row gap-2.5 ${
                      isProductOutOfStock(item.stockQuantity)
                      ? "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
                      :
                      Number(form.items?.[item.name] || 0) > 0
                      ? "border-blue-600 bg-blue-50/50 ring-4 ring-blue-50"
                      : "border-slate-100 hover:border-slate-300 bg-white"
                    }`}
                  >
                    {/* Product Image */}
                    <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-lg bg-[#FAF9F5] border border-slate-200/50 p-1 shadow-sm">
                      {getProductImage(item.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {Number(form.items?.[item.name] || 0) > 0 && (
                        <CheckCircle2 size={16} className="absolute top-2 right-2 text-blue-600" />
                      )}
                      <p className={`text-xs sm:text-sm font-bold truncate ${Number(form.items?.[item.name] || 0) > 0 ? "text-blue-900" : "text-slate-600"}`}>{item.name}</p>
                      <p className="text-sm sm:text-base font-black text-slate-900 mt-0.5">Rs {item.ratePerUnit}<span className="text-[9px] text-slate-400 font-normal">/{item.unit}</span></p>
                      <p className={`text-[9px] sm:text-[10px] mt-0.5 font-semibold ${isProductOutOfStock(item.stockQuantity) ? "text-red-500" : "text-emerald-600"}`}>
                        Stock: {formatProductStockLabel(item.stockQuantity)}
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                        {Number(form.items?.[item.name] || 0) > 0 ? `${form.items?.[item.name]}L selected` : "Tap to add"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
              {dairy.productItems.length === 0 && (
                <div className="px-6 pb-6 text-sm text-red-600">No products available in this dairy right now.</div>
              )}
              {selectedItems.length > 0 && (
                <div className="border-t border-slate-200 px-6 py-5 space-y-3 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800">Selected Items</h3>
                    <p className="text-xs text-slate-500">
                      {selectedItems.length} product{selectedItems.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  {selectedItems.map((item) => (
                    <div key={item.name} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Rs {item.ratePerUnit}/{item.unit}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateSelectedItemQuantity(item.name, item.quantity - 0.5)}
                            className="rounded-full border border-slate-200 p-2 text-slate-500"
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={item.quantity}
                            onChange={(e) => updateSelectedItemQuantity(item.name, e.target.value)}
                            className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-center font-bold outline-none focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => updateSelectedItemQuantity(item.name, item.quantity + 0.5)}
                            className="rounded-full border border-slate-200 p-2 text-slate-500"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Products In Order</label>
                    <div className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-lg font-bold text-slate-900">
                      {selectedItems.length}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Date</label>
                    {isCustomerExtraFlow ? (
                      <div className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-900">
                        {new Date(`${nextDayDeliveryDate}T00:00:00`).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        • Next day delivery
                      </div>
                    ) : (
                      <input
                        type="date" min={toDateInput(new Date())}
                        value={form.deliveryDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white font-semibold outline-none focus:border-blue-500 transition-all"
                      />
                    )}
                  </div>
                </div>

                {selectedProduct && (
                  <p className={`text-xs font-semibold ${isOutOfStock || exceedsStock ? "text-red-600" : "text-emerald-600"}`}>
                    Focused product stock: {isOutOfStock ? "Out of Stock" : Number.isFinite(availableStock) ? availableStock : "Unlimited"}
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

          <div id="order-summary-section" className="lg:w-[380px] space-y-6 scroll-mt-24">
            <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl sticky top-24">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <CreditCard size={20} className="text-blue-400" /> Order Summary
              </h3>

              <div className="space-y-4 border-b border-slate-800 pb-6 mb-6">
                {selectedItems.length > 0 ? (
                  selectedItems.map((item) => (
                    <div key={item.name} className="flex justify-between text-sm">
                      <span className="text-slate-400">{item.name} x {item.quantity}L</span>
                      <span className="font-bold">Rs {(item.quantity * item.ratePerUnit).toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-400">No products selected yet.</div>
                )}
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
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
                  <p className="text-sm font-bold text-white">Online payment required</p>
                  <p className="mt-1 text-xs text-slate-300">
                    One-time deliveries are confirmed only after successful payment.
                  </p>
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
                disabled={submitting || (hasSubscriptionForThisDairy && !isCustomerExtraFlow) || !hasAvailableSlot || !selectedItems.length || Boolean(invalidStockItem) || dairy.productItems.length === 0}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all transform active:scale-[0.98] disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
              >
                {submitting
                  ? "Processing..."
                  : hasSubscriptionForThisDairy && !isCustomerExtraFlow
                  ? "Unavailable For Active Subscribers"
                  : isCustomerExtraFlow
                  ? "Pay & Add Extra"
                  : "Pay & Place Order"}
              </button>
              {(invalidStockItem || !selectedItems.length) && (
                <p className="mt-2 text-xs text-red-400 font-medium">
                  {invalidStockItem
                    ? `${invalidStockItem.name} quantity is more than available stock`
                    : "Select at least one product"}
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
              One or more selected products already have an order for this date. Do you want to order again or cancel?
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

      {/* Sticky Mobile Bottom Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] flex items-center justify-between lg:hidden animate-in slide-in-from-bottom duration-300">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500 font-semibold">{selectedItems.length} Product{selectedItems.length > 1 ? "s" : ""} Selected</span>
            <span className="text-lg font-black text-slate-900">Rs {totalPrice.toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const summaryEl = document.getElementById("order-summary-section");
              if (summaryEl) {
                summaryEl.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all transform active:scale-95"
          >
            Continue to Details
          </button>
        </div>
      )}
    </div>
  );
};

export default BuyOncePage;
