import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, ShoppingBag } from "lucide-react";
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
import { loadRazorpayCheckout } from "../../utils/loadRazorpay.js";
import {
  computeTotalPrice,
  getDefaultBuyOnceDate,
  getDeliverySlotOptions,
  getOrderPaymentId,
  getTomorrowBuyOnceDate,
  hasOpenSubscriptionStatus,
  isProductOutOfStock,
  normalizeProducts,
  toDateInput,
} from "../../utils/buyOnce.js";
import { OrderSummary } from "../../components/buyOnce/OrderSummary.jsx";
import { ProductCard } from "../../components/buyOnce/ProductCard.jsx";
import { SelectedItemRow } from "../../components/buyOnce/SelectedItemRow.jsx";
import { SlotOptionCard } from "../../components/buyOnce/SlotOptionCard.jsx";

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
    () => computeTotalPrice(selectedItems),
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

  const loadRazorpayCheckoutScript = () => loadRazorpayCheckout();

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
                  <ProductCard
                    key={item.id}
                    item={item}
                    form={form}
                    setForm={setForm}
                    toggleProductSelection={toggleProductSelection}
                  />
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
                    <SelectedItemRow
                      key={item.name}
                      item={item}
                      updateSelectedItemQuantity={updateSelectedItemQuantity}
                    />
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
                      <SlotOptionCard key={slot.id} slot={slot} form={form} setForm={setForm} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <OrderSummary
            selectedItems={selectedItems}
            totalPrice={totalPrice}
            form={form}
            setForm={setForm}
            handleSubmit={handleSubmit}
            submitting={submitting}
            hasSubscriptionForThisDairy={hasSubscriptionForThisDairy}
            isCustomerExtraFlow={isCustomerExtraFlow}
            hasAvailableSlot={hasAvailableSlot}
            invalidStockItem={invalidStockItem}
            dairy={dairy}
            nextAvailableDate={nextAvailableDate}
          />
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
