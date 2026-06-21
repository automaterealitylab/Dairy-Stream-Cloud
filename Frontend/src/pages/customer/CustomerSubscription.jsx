import React, { useEffect, useState } from 'react';
import CustomerLayout from '../../components/customer/layouts/CustomerLayout';
import { Droplet, Clock, Edit, PauseCircle, PlayCircle, Store, X, CircleX, Loader2, Smartphone, CreditCard, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchPublicDairyById } from '../../api/public.api.js';
import {
  fetchCustomerSubscription,
  getCachedCustomerSubscription,
  fetchCustomerPayments,
  getCachedCustomerPayments,
  createCustomerPaymentOrder,
  verifyCustomerPayment,
  saveCustomerSubscription,
  clearCustomerSubscription,
  createCustomerUpiPaymentIntent,
  submitCustomerUpiPaymentVerification,
  previewCustomerPaymentScreenshotOcr,
} from '../../api/customer/customer.api.js';
import LoadingIndicator from '../../components/common/LoadingIndicator.jsx';

const headingFont = { fontFamily: "'Lora', serif" };
const fmtCurrency = (amount) => `Rs.${Number(amount || 0).toFixed(2)}`;

/* ======================================================
   HELPERS & CONSTANTS
====================================================== */
const EMPTY_FORM = {
  dairyId: null,
  product: 'Buffalo Milk',
  quantity: 1,
  slot: 'Morning',
  timeRange: '6:00 - 9:00 AM',
  status: 'ACTIVE',
  approvalStatus: 'PENDING',
  assignedAgentId: null,
  startDate: '',
  address: '',
  paymentMethod: 'UPI',
  deliveryDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
};

const DAY_OPTIONS = [
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
  { key: 'SATURDAY', label: 'Saturday' },
  { key: 'SUNDAY', label: 'Sunday' },
];

const isMilkLikeProduct = (item = {}) => {
  const normalizedType = String(item.type || 'MILK').trim().toUpperCase();
  const normalizedName = String(item.name || '').trim().toUpperCase();
  return normalizedType.includes('MILK') || normalizedName.includes('MILK');
};

const normalizeSubscriptionProducts = (dairy = {}) => {
  const explicitItems = Array.isArray(dairy?.productItems) ? dairy.productItems : [];
  if (explicitItems.length > 0) {
    return explicitItems
      .map((item) => ({
        id: item.id || item.name,
        name: String(item.name || '').trim(),
        type: String(item.type || 'MILK').trim().toUpperCase(),
        ratePerUnit: Number(item.ratePerUnit || 0),
        stockQuantity: Number(item.stockQuantity || 0),
      }))
      .filter((item) => item.name && isMilkLikeProduct(item));
  }

  const legacyProducts = dairy?.products || {};
  return Object.keys(legacyProducts).map((name) => ({
    id: name,
    name,
    type: 'MILK',
    ratePerUnit: Number(legacyProducts[name] || 0),
    stockQuantity: Number.POSITIVE_INFINITY,
  }));
};

const normalizeDeliveryDays = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((day) => String(day || '').trim().toUpperCase())
        .filter(Boolean)
    )];
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return [...new Set(
          parsed
            .map((day) => String(day || '').trim().toUpperCase())
            .filter(Boolean)
        )];
      }
    } catch {
      return [...new Set(
        value
          .split(',')
          .map((day) => day.trim().toUpperCase())
          .filter(Boolean)
      )];
    }
  }

  return [];
};

// ✅ UI Mapper
const toUiSubscription = (record) => {
  if (!record) return null;
  const slot = record.delivery_slot || 'Morning';
  const resolvedDeliveryDays = normalizeDeliveryDays(record.delivery_days);
  return {
    dairyId: record.dairy_id ?? null,
    product: record.milk_type || 'Milk',
    quantity: Number(record.quantity_liters || 0),
    slot,
    timeRange: slot === 'Evening' ? '5:00 - 8:00 PM' : '6:00 - 9:00 AM',
    status: (record.status || 'ACTIVE').toUpperCase(),
    approvalStatus: (record.approval_status || 'PENDING').toUpperCase(),
    assignedAgentId: record.assigned_agent_id ?? null,
    startDate: record.start_date || '',
    address: record.address || '',
    paymentMethod: record.payment_method || 'UPI',
    deliveryDays:
      resolvedDeliveryDays.length > 0
        ? resolvedDeliveryDays
        : DAY_OPTIONS.map((day) => day.key),
  };
};

// ✅ Payload Mapper
const toSavePayload = (model, overrides = {}) => {
  const next = { ...model, ...overrides };
  return {
    dairyId: next.dairyId,
    milkType: next.product,
    quantity: Number(next.quantity),
    slot: next.slot,
    startDate: next.startDate || undefined,
    address: next.address || '',
    paymentMethod: next.paymentMethod || 'UPI',
    deliveryDays: normalizeDeliveryDays(next.deliveryDays),
    status: (next.status || 'ACTIVE').toUpperCase(),
    approvalStatus: (next.approvalStatus || 'PENDING').toUpperCase(),
    assignedAgentId: next.assignedAgentId ?? null,
  };
};

/* ======================================================
   MAIN COMPONENT
====================================================== */
const Subscribe = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const cachedSubscriptionData = getCachedCustomerSubscription();
  const cachedPaymentsData = getCachedCustomerPayments();
  const initialSubscription = toUiSubscription(cachedSubscriptionData?.subscription);

  const [subscription, setSubscription] = useState(initialSubscription);
  const [formData, setFormData] = useState(initialSubscription || EMPTY_FORM);

  const [loading, setLoading] = useState(() => !cachedSubscriptionData);
  const [saving, setSaving] = useState(false);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [paymentsSummary, setPaymentsSummary] = useState({
    monthlyDue: Number(cachedPaymentsData?.summary?.monthlyDue || 0),
    payableTillDate: Number(cachedPaymentsData?.summary?.payableTillDate || 0),
    billingSummaryAmount: Number(
      cachedPaymentsData?.summary?.billingSummaryAmount ??
        cachedPaymentsData?.summary?.monthlyDue ??
        cachedPaymentsData?.summary?.payableTillDate ??
        0
    ),
    beneficiary: cachedPaymentsData?.summary?.beneficiary || null,
  });

  const [paymentSelectorOpen, setPaymentSelectorOpen] = useState(false);
  const [upiIntent, setUpiIntent] = useState(null);
  const [upiForm, setUpiForm] = useState({ utrNumber: "", payerUpiId: "", screenshotFile: null });
  const [ocrPreview, setOcrPreview] = useState(null);
  const [ocrPreviewing, setOcrPreviewing] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);

  const [toast, setToast] = useState(null);
  const [closing, setClosing] = useState(false);
  const [payingCloseDue, setPayingCloseDue] = useState(false);
  const [pendingDuesModal, setPendingDuesModal] = useState({
    open: false,
    message: '',
  });

  const locationGuestDairyId = location.state?.guestDairyId ?? null;
  const locationGuestDairyName = location.state?.guestDairyName ?? "";
  const guestDairyId =
    locationGuestDairyId != null
      ? String(locationGuestDairyId)
      : localStorage.getItem("guest_dairy_id");
  const guestDairyName =
    locationGuestDairyName || localStorage.getItem("guest_dairy_name") || "";
  const hasActivePlan =
    !!subscription && String(subscription.status || "ACTIVE").toUpperCase() !== "CLOSED";
  const isApprovalPending =
    hasActivePlan && String(subscription?.approvalStatus || "PENDING").toUpperCase() === "PENDING";
  const isPartnerAssignmentPending =
    hasActivePlan &&
    String(subscription?.approvalStatus || "PENDING").toUpperCase() === "APPROVED" &&
    !subscription?.assignedAgentId;
  const isApprovedSubscription =
    hasActivePlan && String(subscription?.approvalStatus || "PENDING").toUpperCase() === "APPROVED";
  const canTogglePauseResume =
    hasActivePlan &&
    isApprovedSubscription &&
    Boolean(subscription?.assignedAgentId) &&
    !saving;
  const closeSubscriptionDueAmount = Number(
    Math.max(
      Number(paymentsSummary?.billingSummaryAmount || 0),
      Number(paymentsSummary?.monthlyDue || 0),
      Number(paymentsSummary?.payableTillDate || 0)
    ).toFixed(2)
  );
  const hasPendingCloseDue = closeSubscriptionDueAmount > 0;

  // -----------------------------------------
  // 1. Initial Data Fetch
  // -----------------------------------------
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        if (!getCachedCustomerSubscription()) {
          setLoading(true);
        }
        // ✅ Token is handled by client.js Interceptor automatically
        const data = await fetchCustomerSubscription();
        const mapped = toUiSubscription(data?.subscription);

        if (!cancelled) {
          setSubscription(mapped);
          setFormData(mapped || EMPTY_FORM);
        }
      } catch (error) {
        console.error('Subscription fetch error:', error.message);
        if (!cancelled) {
          if (!subscription) {
            setSubscription(null);
            setFormData(EMPTY_FORM);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchPayments = async () => {
      try {
        const data = await fetchCustomerPayments();
        if (cancelled) return;

        setPaymentsSummary({
          monthlyDue: Number(data?.summary?.monthlyDue || 0),
          payableTillDate: Number(data?.summary?.payableTillDate || 0),
          billingSummaryAmount: Number(
            data?.summary?.billingSummaryAmount ??
              data?.summary?.monthlyDue ??
              data?.summary?.payableTillDate ??
              0
          ),
          beneficiary: data?.summary?.beneficiary || null,
        });
      } catch {
        if (cancelled) return;
      }
    };

    fetchPayments();

    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------------
  // 2. Dashboard Redirect Logic
  // -----------------------------------------
  useEffect(() => {
    const shouldOpenUpdateFromDashboard =
      Boolean(location.state?.openUpdateModal) && location.state?.editMode === "next-day-delivery";

    if (!shouldOpenUpdateFromDashboard || loading) return;

    if (subscription) {
      setShowUpdateModal(true);
    } else {
      showToastMessage('error', 'No active subscription found');
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, loading, subscription, navigate, location.pathname]);

  useEffect(() => {
    if (loading) return;

    if (hasActivePlan) {
      localStorage.removeItem("guest_dairy_id");
      localStorage.removeItem("guest_dairy_name");
    }
  }, [loading, hasActivePlan]);

  useEffect(() => {
    let cancelled = false;

    const loadAvailableProducts = async () => {
      if (!showUpdateModal || !subscription?.dairyId) return;

      setProductsLoading(true);
      setProductsError('');
      try {
        const response = await fetchPublicDairyById(subscription.dairyId);
        const dairy = response?.dairy || null;
        const products = normalizeSubscriptionProducts(dairy);

        if (cancelled) return;

        setAvailableProducts(products);

        if (products.length === 0) {
          setProductsError('No milk products are available in this dairy right now.');
          return;
        }

        const hasSelectedProduct = products.some((item) => item.name === formData.product);
        if (!hasSelectedProduct) {
          setFormData((prev) => ({ ...prev, product: products[0].name }));
        }
      } catch (error) {
        if (cancelled) return;
        setAvailableProducts([]);
        setProductsError(error?.message || 'Failed to load dairy products.');
      } finally {
        if (!cancelled) {
          setProductsLoading(false);
        }
      }
    };

    loadAvailableProducts();

    return () => {
      cancelled = true;
    };
  }, [showUpdateModal, subscription?.dairyId, formData.product]);

  const showToastMessage = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);

      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(true), { once: true });
        existingScript.addEventListener('error', () => resolve(false), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const refreshPaymentsSummary = async () => {
    const data = await fetchCustomerPayments({ force: true });
    setPaymentsSummary({
      monthlyDue: Number(data?.summary?.monthlyDue || 0),
      payableTillDate: Number(data?.summary?.payableTillDate || 0),
      billingSummaryAmount: Number(
        data?.summary?.billingSummaryAmount ??
          data?.summary?.monthlyDue ??
          data?.summary?.payableTillDate ??
          0
      ),
      beneficiary: data?.summary?.beneficiary || null,
    });
    return data;
  };

  useEffect(() => {
    loadRazorpay().catch(() => false);
  }, []);

  // -----------------------------------------
  // 3. Update Plan Logic
  // -----------------------------------------
  const updatePlan = async () => {
    if (!subscription?.dairyId) {
      showToastMessage('error', 'No active subscription found');
      return;
    }

    setSaving(true);
    try {
      // ✅ FIX: Removed token argument. Passing ONLY the payload.
      const result = await saveCustomerSubscription(
        toSavePayload(formData, {
          dairyId: subscription.dairyId,
          status: subscription.status,
          startDate: subscription.startDate,
          address: subscription.address,
          paymentMethod: subscription.paymentMethod,
        })
      );

      const mapped = toUiSubscription(result?.subscription);
      setSubscription(mapped);
      setFormData(mapped || EMPTY_FORM);
      setShowUpdateModal(false);
      showToastMessage('success', 'Subscription updated successfully');
    } catch (err) {
      showToastMessage('error', err?.message || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------
  // 4. Pause / Resume Logic
  // -----------------------------------------
  const updateStatus = async (status) => {
    if (!subscription?.dairyId) {
      showToastMessage('error', 'No active subscription found');
      return;
    }

    setSaving(true);
    try {
      // ✅ FIX: Removed token argument.
      const result = await saveCustomerSubscription(
        toSavePayload(subscription, { status })
      );

      const mapped = toUiSubscription(result?.subscription);
      setSubscription(mapped);
      setFormData(mapped || EMPTY_FORM);
      showToastMessage('success', status === 'PAUSED' ? 'Subscription paused' : 'Subscription resumed');
    } catch (err) {
      showToastMessage('error', err?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const pause = () => updateStatus('PAUSED');
  const resume = () => updateStatus('ACTIVE');

  // -----------------------------------------
  // 5. Cancel Subscription Logic
  // -----------------------------------------
  const cancelSubscription = async () => {
    setClosing(true);
    try {
      // ✅ FIX: Removed token argument.
      await clearCustomerSubscription();
      setShowCancelModal(false);
      setSubscription(null);
      setFormData(EMPTY_FORM);
      showToastMessage('success', 'Subscription removed successfully');
      setTimeout(() => navigate('/explore', { state: { from: 'customer-subscriptions' } }), 900);
    } catch (err) {
      const message = err?.message || 'Failed to close subscription';
      const normalizedMessage = String(message).toLowerCase();

      if (
        normalizedMessage.includes('pending monthly subscription dues') ||
        normalizedMessage.includes('clear all pending') ||
        normalizedMessage.includes('running subscription bill') ||
        normalizedMessage.includes('current unpaid due')
      ) {
        setShowCancelModal(false);
        setPendingDuesModal({
          open: true,
          message,
        });
      } else {
        showToastMessage('error', message);
      }
    } finally {
      setClosing(false);
    }
  };

  const handleExecuteRazorpayPayment = async () => {
    try {
      setPayingCloseDue(true);
      if (!(await loadRazorpay())) {
        throw new Error('Could not load payment gateway.');
      }

      const orderPayload = await createCustomerPaymentOrder({ payAll: true });
      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: orderPayload.order.amount,
        currency: orderPayload.order.currency,
        name: 'Dairy Vision',
        description: 'Subscription bill payment',
        order_id: orderPayload.order.id,
        handler: async (res) => {
          try {
            await verifyCustomerPayment({
              payAll: true,
              razorpay_order_id: res.razorpay_order_id,
              razorpay_payment_id: res.razorpay_payment_id,
              razorpay_signature: res.razorpay_signature,
            });

            await refreshPaymentsSummary();
            setPendingDuesModal({ open: false, message: '' });
            await cancelSubscription();
          } catch (err) {
            showToastMessage('error', err?.message || 'Payment succeeded, but closing subscription failed.');
          } finally {
            setPayingCloseDue(false);
          }
        },
        theme: { color: '#2C1A0E' },
        modal: {
          ondismiss: () => {
            setPayingCloseDue(false);
            showToastMessage(
              'error',
              'Payment cancelled. Subscription not closed. Daily delivery will continue as per plan.'
            );
          },
        },
      });

      checkout.on('payment.failed', (res) => {
        setPayingCloseDue(false);
        showToastMessage(
          'error',
          res?.error?.description || 'Payment cancelled. Subscription not closed. Daily delivery will continue as per plan.'
        );
      });

      checkout.open();
    } catch (err) {
      setPayingCloseDue(false);
      showToastMessage('error', err?.message || 'Unable to start payment.');
    }
  };

  const handleExecuteUpiPayment = async () => {
    try {
      setPayingCloseDue(true);
      const intentPayload = await createCustomerUpiPaymentIntent({ payAll: true, includeRunningDue: true });
      setUpiIntent({ ...intentPayload, payAll: true });
      setUpiForm({ utrNumber: "", payerUpiId: "", screenshotFile: null });
      setOcrPreview(null);
    } catch (err) {
      showToastMessage('error', err?.response?.data?.message || err?.message || "Unable to start UPI payment.");
    } finally {
      setPayingCloseDue(false);
    }
  };

  const handleScreenshotSelected = async (file) => {
    setUpiForm((prev) => ({ ...prev, screenshotFile: file || null }));
    setOcrPreview(null);
    if (!file) return;

    try {
      setOcrPreviewing(true);
      const result = await previewCustomerPaymentScreenshotOcr(file);
      const extracted = result?.extracted || {};
      setOcrPreview(result?.ocr || null);
      setUpiForm((prev) => ({
        ...prev,
        utrNumber: extracted.utrNumber || prev.utrNumber,
        payerUpiId: extracted.payerUpiId || prev.payerUpiId,
        screenshotFile: file,
      }));
    } catch (err) {
      setOcrPreview({ status: "FAILED", error: err?.response?.data?.message || err?.message });
    } finally {
      setOcrPreviewing(false);
    }
  };

  const handleSubmitUpiVerification = async () => {
    try {
      if (!upiIntent) return;
      if (!String(upiForm.utrNumber || "").trim()) {
        showToastMessage('error', "Enter the UTR/reference number after payment.");
        return;
      }

      setSubmittingVerification(true);
      await submitCustomerUpiPaymentVerification({
        paymentId: upiIntent.paymentId || "",
        payAll: upiIntent.payAll ? "true" : "false",
        includeRunningDue: "true",
        amount: upiIntent.amount,
        utrNumber: upiForm.utrNumber,
        payerUpiId: upiForm.payerUpiId,
        screenshotFile: upiForm.screenshotFile,
      });
      setUpiIntent(null);
      await refreshPaymentsSummary();
      setPendingDuesModal({ open: false, message: '' });
      await cancelSubscription();
    } catch (err) {
      showToastMessage('error', err?.response?.data?.message || err?.message || "Unable to submit verification.");
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handlePayDuesAndClose = async () => {
    if (!hasPendingCloseDue) {
      await cancelSubscription();
      return;
    }

    const beneficiary = paymentsSummary?.beneficiary;
    const hasRazorpay = Boolean(beneficiary?.razorpayLinkedAccountId);
    const hasUpi = Boolean(beneficiary?.upiId);
    let optOnline = false;
    let optUpi = false;

    // Check what the dairy selected for this type of payment (subscription)
    const methodSelected = beneficiary?.subscriptionPaymentMethod || "DIRECT_UPI";

    if (hasRazorpay && hasUpi) {
      if (methodSelected === "RAZORPAY") {
        optOnline = true;
      } else {
        optUpi = true;
      }
    } else if (hasRazorpay) {
      optOnline = true;
    } else if (hasUpi) {
      optUpi = true;
    }

    if (!optOnline && !optUpi) {
      optOnline = true;
      optUpi = true;
    }

    if (optOnline && !optUpi) {
      handleExecuteRazorpayPayment();
    } else if (optUpi && !optOnline) {
      handleExecuteUpiPayment();
    } else {
      setPaymentSelectorOpen(true);
    }
  };

  return (
    <CustomerLayout>
      <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 sm:space-y-6 lg:space-y-10" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="rounded-[24px] border border-[#EDE8DF] bg-[#F5F0E8] p-4 shadow-[0_20px_60px_rgba(84,52,16,0.08)] sm:rounded-[30px] sm:p-7 xl:p-9">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
            Subscription Center
          </p>
          <h2 className="mt-2 text-[26px] font-semibold leading-tight text-[#2C1A0E] sm:text-[36px]" style={headingFont}>
            My <span className="text-[#B8641A]">Subscription</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8B7355]">
            Manage your daily milk plan, pause deliveries, or explore other dairies.
          </p>

        {loading ? (
          <div className="mt-8 space-y-8">
            <LoadingIndicator className="py-6" message="Loading subscription..." />
            <div className="space-y-8 animate-pulse">
              <div className="h-32 rounded-[24px] bg-[#EADFCC]"></div>
              <div className="grid gap-4 md:grid-cols-3 md:gap-6">
                <div className="h-24 rounded-[20px] bg-[#EADFCC]"></div>
                <div className="h-24 rounded-[20px] bg-[#EADFCC]"></div>
                <div className="h-24 rounded-[20px] bg-[#EADFCC]"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Status Card */}
            <div
              className={`mt-6 w-full rounded-[22px] border p-4 shadow-sm transition hover:shadow-md sm:mt-8 sm:rounded-[26px] sm:p-8 ${
                !subscription
                  ? 'bg-[#FBF7F0] border-[#E7DAC6]'
                  : subscription.status === 'ACTIVE'
                  ? 'bg-[#EEF5E7] border-[#DDE8D1]'
                  : subscription.status === 'PAUSED'
                  ? 'bg-[#FFF1E4] border-[#F0D1B2]'
                  : 'bg-[#FDECEA] border-[#F2D0C8]'
              }`}
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#A88763]">
                    {hasActivePlan ? `${subscription.status} PLAN` : 'NO ACTIVE PLAN'}
                  </p>
                  <h3 className="mt-1 break-words text-[22px] font-semibold leading-tight text-[#2C1A0E] sm:text-[30px]" style={headingFont}>
                    {hasActivePlan ? `${subscription.quantity} Liters ${subscription.product}` : 'No subscription yet'}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#8B7355]">
                    {hasActivePlan
                      ? `${subscription.slot} Slot - ${subscription.timeRange}`
                      : guestDairyId
                      ? `You can start subscription directly with ${guestDairyName || `Dairy #${guestDairyId}`}.`
                      : 'Choose a dairy and create your plan from See Other Dairies'}
                  </p>
                  {hasActivePlan && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isApprovalPending && (
                        <span className="rounded-full border border-[#F0D1B2] bg-[#FFF1E4] px-2.5 py-1 text-[11px] font-semibold text-[#B8641A]">
                          Subscription approval pending
                        </span>
                      )}
                      {isPartnerAssignmentPending && (
                        <span className="rounded-full border border-[#EFD7B3] bg-[#FFF4E2] px-2.5 py-1 text-[11px] font-semibold text-[#8C5A1A]">
                          Delivery partner assignment pending
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {hasActivePlan ? (
                  <div className="grid gap-3 sm:flex sm:flex-row sm:flex-wrap">
                    <button
                      disabled={saving}
                      onClick={() => setShowUpdateModal(true)}
                      className="group flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#EFD7B3] bg-white px-5 py-2 text-sm font-bold text-[#B8641A] shadow-[0_10px_22px_rgba(74,124,47,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#B8641A] hover:bg-[#FFF4E2] hover:shadow-[0_14px_28px_rgba(184,100,26,0.22)] focus:outline-none focus:ring-2 focus:ring-[#FDE9C9] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-[#EFD7B3] disabled:hover:bg-white disabled:hover:shadow-[0_10px_22px_rgba(74,124,47,0.08)] sm:w-auto"
                    >
                      <Edit size={16} /> Update Plan
                    </button>

                    {subscription.status === 'ACTIVE' ? (
                      <button
                        disabled={!canTogglePauseResume}
                        onClick={pause}
                        className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#F0D1B2] bg-white px-5 py-2 text-sm font-bold text-[#C86A2B] shadow-[0_10px_22px_rgba(200,106,43,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C86A2B] hover:bg-[#FFF1E4] hover:shadow-[0_14px_28px_rgba(200,106,43,0.18)] focus:outline-none focus:ring-2 focus:ring-[#F8D8B6] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-[#F0D1B2] disabled:hover:bg-white disabled:hover:shadow-[0_10px_22px_rgba(200,106,43,0.08)] sm:w-auto"
                      >
                        <PauseCircle size={16} /> Pause
                      </button>
                    ) : (
                      <button
                        disabled={!canTogglePauseResume}
                        onClick={resume}
                        className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#DDE8D1] bg-white px-5 py-2 text-sm font-bold text-[#4A7C2F] shadow-[0_10px_22px_rgba(74,124,47,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#4A7C2F] hover:bg-[#EEF5E7] hover:shadow-[0_14px_28px_rgba(74,124,47,0.22)] focus:outline-none focus:ring-2 focus:ring-[#DDE8D1] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-[#DDE8D1] disabled:hover:bg-white disabled:hover:shadow-[0_10px_22px_rgba(74,124,47,0.08)] sm:w-auto"
                      >
                        <PlayCircle size={16} /> Resume
                      </button>
                    )}

                    <button
                      disabled={saving}
                      onClick={() => setShowCancelModal(true)}
                      className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#F2D0C8] bg-white px-5 py-2 text-sm font-bold text-[#C0392B] shadow-[0_10px_22px_rgba(192,57,43,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C0392B] hover:bg-[#FDECEA] hover:shadow-[0_14px_28px_rgba(192,57,43,0.2)] focus:outline-none focus:ring-2 focus:ring-[#F2D0C8] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:border-[#F2D0C8] disabled:hover:bg-white disabled:hover:shadow-[0_10px_22px_rgba(192,57,43,0.08)] sm:w-auto"
                    >
                      <CircleX size={16} />
                      {isApprovedSubscription ? 'Close Subscription' : 'Cancel Subscription'}
                    </button>
                  </div>
                ) : (
                  guestDairyId ? (
                    <button
                      onClick={() =>
                        navigate(`/join/${guestDairyId}`, {
                          state: { openSubscriptionModal: true, from: 'customer-subscriptions' },
                        })
                      }
                      className="min-h-[46px] w-full rounded-[14px] bg-[#B8641A] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#9F5313] sm:w-auto"
                    >
                      Take Subscription for {guestDairyName || `Dairy #${guestDairyId}`}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate('/explore', { state: { from: 'customer-subscriptions' } })}
                      className="min-h-[46px] w-full rounded-[14px] bg-[#B8641A] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#9F5313] sm:w-auto"
                    >
                      See Other Dairies
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Stats Grid */}
            {hasActivePlan && (
              <div className="mt-6 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3 md:gap-7">
                <StatCard icon={<Droplet size={24} />} label="Daily Quantity" value={`${subscription.quantity} Liters`} />
                <StatCard icon={<Clock size={24} />} label="Delivery Slot" value={subscription.slot} />
                <StatCard
                  icon={subscription.status === 'ACTIVE' ? <PlayCircle size={24} /> : <PauseCircle size={24} />}
                  label="Status"
                  value={subscription.status}
                />
              </div>
            )}

            <div className="mt-6 sm:mt-8">
              <ExploreOtherDairiesSection onExplore={() => navigate('/explore', { state: { from: 'customer-subscriptions' } })} />
            </div>
          </>
        )}
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && subscription && (
        <ModalWrapper>
          <ModalHeader
            title="Update Subscription"
            subtitle="Manage your milk delivery"
            onClose={() => setShowUpdateModal(false)}
          />
          <div className="grid gap-4 px-5 py-4 sm:px-8 sm:py-5 md:grid-cols-2 overflow-y-auto flex-1">
            <InputBlock label="Product">
              <>
                <select
                  className="w-full rounded-[14px] border border-[#EDE8DF] bg-[#FBF7F0] p-3 outline-none focus:ring-2 focus:ring-[#D4B896] disabled:opacity-60"
                  value={formData.product}
                  onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                  disabled={productsLoading || availableProducts.length === 0}
                >
                  {productsLoading ? (
                    <option>Loading products...</option>
                  ) : availableProducts.length > 0 ? (
                    availableProducts.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))
                  ) : (
                    <option>No milk products available</option>
                  )}
                </select>
                {productsError && (
                  <p className="mt-2 text-xs font-medium text-[#C0392B]">{productsError}</p>
                )}
              </>
            </InputBlock>

            <InputBlock label="Quantity (Liters)">
              <input
                type="number"
                step="0.5"
                min="0.5"
                className="w-full rounded-[14px] border border-[#EDE8DF] bg-[#FBF7F0] p-3 outline-none focus:ring-2 focus:ring-[#D4B896]"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </InputBlock>

            <InputBlock label="Delivery Slot">
              <select
                className="w-full rounded-[14px] border border-[#EDE8DF] bg-[#FBF7F0] p-3 outline-none focus:ring-2 focus:ring-[#D4B896]"
                value={formData.slot}
                onChange={(e) => setFormData({ ...formData, slot: e.target.value })}
              >
                <option>Morning</option>
                <option>Evening</option>
              </select>
            </InputBlock>

            <div className="md:col-span-2">
              <InputBlock label="Delivery Days">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {DAY_OPTIONS.map((day) => {
                    const checked = Array.isArray(formData.deliveryDays)
                      ? formData.deliveryDays.includes(day.key)
                      : false;

                    return (
                      <label
                        key={day.key}
                        className={`flex cursor-pointer items-center justify-between rounded-[14px] border px-2.5 py-2 transition ${
                          checked
                            ? 'border-[#D4B896] bg-[#FBF7F0] shadow-sm'
                            : 'border-[#EDE8DF] bg-white hover:border-[#D4B896]'
                        }`}
                      >
                        <span className="text-xs font-semibold text-gray-700 sm:text-sm">{day.label}</span>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current = Array.isArray(formData.deliveryDays)
                              ? formData.deliveryDays
                              : [];

                            const nextDays = e.target.checked
                              ? [...new Set([...current, day.key])]
                              : current.filter((item) => item !== day.key);

                            setFormData({
                              ...formData,
                              deliveryDays: nextDays,
                            });
                          }}
                          className="h-4.5 w-4.5 accent-[#B8641A]"
                        />
                      </label>
                    );
                  })}
                </div>
              </InputBlock>
            </div>
          </div>
          <ModalFooter
            onCancel={() => setShowUpdateModal(false)}
            onConfirm={updatePlan}
            confirmText={saving ? 'Saving...' : 'Save Changes'}
          />
        </ModalWrapper>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <ModalWrapper small>
          <div className="p-5 sm:p-8">
            <h3 className="text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
              {isApprovedSubscription ? 'Close Subscription?' : 'Cancel Subscription?'}
            </h3>
            <p className="mt-3 text-[#8B7355]">
              {isApprovedSubscription
                ? hasPendingCloseDue
                  ? `Pending dues found: ${fmtCurrency(closeSubscriptionDueAmount)}. Please pay this amount first, then close the subscription.`
                  : 'No dues are pending. You can close your subscription now.'
                : 'Are you sure you want to cancel your subscription? Your subscription is still pending approval, so cancelling will simply remove the pending request.'}
            </p>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-[14px] border border-[#EDE8DF] px-6 py-2 transition hover:bg-[#FBF7F0]"
              >
                Keep It
              </button>
              <button
                onClick={
                  isApprovedSubscription && hasPendingCloseDue
                    ? handlePayDuesAndClose
                    : cancelSubscription
                }
                disabled={closing || payingCloseDue}
                className="flex items-center gap-2 rounded-[14px] bg-[#C0392B] px-6 py-2 text-white transition hover:bg-[#A63125] disabled:bg-[#D48B84]"
              >
                {(closing || payingCloseDue) && <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                {closing
                  ? (isApprovedSubscription ? 'Closing...' : 'Cancelling...')
                  : payingCloseDue
                  ? 'Preparing Payment...'
                  : isApprovedSubscription && hasPendingCloseDue
                  ? `Pay ${fmtCurrency(closeSubscriptionDueAmount)} and Close Subscription`
                  : (isApprovedSubscription ? 'Yes, Close Subscription' : 'Yes, Cancel Subscription')}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {pendingDuesModal.open && (
        <ModalWrapper small>
          <div className="p-5 sm:p-8">
            <h3 className="text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>
              Pay Subscription Bill First
            </h3>
            <p className="mt-3 text-[#8B7355]">
              {pendingDuesModal.message ||
                'Please clear your running subscription bill before closing this subscription.'}
            </p>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setPendingDuesModal({ open: false, message: '' })}
                className="rounded-[14px] border border-[#EDE8DF] px-6 py-2 transition hover:bg-[#FBF7F0]"
              >
                Keep Subscription
              </button>
              <button
                onClick={handlePayDuesAndClose}
                disabled={payingCloseDue || closing}
                className="rounded-[14px] bg-[#B8641A] px-6 py-2 text-white transition hover:bg-[#9F5313] disabled:bg-[#D8A678]"
              >
                {payingCloseDue
                  ? 'Preparing Payment...'
                  : hasPendingCloseDue
                  ? `Pay ${fmtCurrency(closeSubscriptionDueAmount)} and Close Subscription`
                  : 'Go To Payments'}
              </button>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* Custom Toast */}
      {toast && (
        <div className="fixed inset-x-3 top-4 z-50 animate-slide-in sm:left-auto sm:right-6 sm:top-6">
          <div
            className={`relative overflow-hidden rounded-[18px] px-4 py-3 text-white shadow-lg sm:min-w-[260px] sm:px-6 sm:py-4 ${
              toast.type === 'success' ? 'bg-[#4A7C2F]' : 'bg-[#C0392B]'
            }`}
          >
            <p className="font-medium">{toast.message}</p>
          </div>
        </div>
      )}

      {paymentSelectorOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-[rgba(20,10,4,0.58)] px-0 py-0 sm:items-center sm:px-4 sm:py-6 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPaymentSelectorOpen(false);
            }
          }}
        >
          <div className="w-full max-w-[500px] overflow-hidden rounded-t-[24px] bg-white shadow-[0_30px_90px_rgba(30,16,8,0.24)] sm:rounded-[24px] animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">
            <div className="h-[4px] w-full bg-[linear-gradient(90deg,#B8641A_0%,#F5C87A_100%)]" />

            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#F2EAE0] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8641A]">
                  Select Payment Option
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-[#1E1008]" style={headingFont}>
                  Pay {fmtCurrency(closeSubscriptionDueAmount)}
                </h3>
                <p className="mt-1 text-xs text-[#8B7355]">
                  Choose how you'd like to pay your dairy bill.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentSelectorOpen(false);
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2EB] text-[#8B7355] transition hover:bg-[#EDE4D8]"
                aria-label="Close payment options selector"
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Body / Selection Cards */}
            <div className="space-y-4 p-5 sm:p-6">
              {/* Option A: Razorpay Online Gateway */}
              <button
                type="button"
                onClick={() => {
                  setPaymentSelectorOpen(false);
                  handleExecuteRazorpayPayment();
                }}
                className="group w-full flex items-start gap-4 rounded-[16px] border border-[#E5DCCF] bg-[#FFFDF9] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#B8641A] hover:bg-[#FFF8EE] hover:shadow-md active:translate-y-0"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#FEF3E6] text-[#B8641A] transition group-hover:bg-[#B8641A] group-hover:text-white">
                  <CreditCard size={20} className="transition" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#2C1A0E]">Instant Online Pay</span>
                    <span className="inline-flex items-center rounded-full bg-[#EBF7F1] px-2 py-0.5 text-[9px] font-bold text-[#1A7A4A]">
                      Fastest
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#B89970]">
                    Pay using Cards, UPI, Netbanking, or Wallets.
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-[#1A7A4A]">
                    Instant payment confirmation
                  </p>
                </div>
              </button>

              {/* Option B: Direct UPI Intent/UTR */}
              <button
                type="button"
                onClick={() => {
                  setPaymentSelectorOpen(false);
                  handleExecuteUpiPayment();
                }}
                className="group w-full flex items-start gap-4 rounded-[16px] border border-[#E5DCCF] bg-[#FFFDF9] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#B8641A] hover:bg-[#FFF8EE] hover:shadow-md active:translate-y-0"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#F7F2EB] text-[#8B7355] transition group-hover:bg-[#2C1A0E] group-hover:text-white">
                  <Smartphone size={20} className="transition" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-[#2C1A0E]">Direct UPI Transfer</span>
                    <span className="inline-flex items-center rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[9px] font-bold text-[#1D5FA5]">
                      No Charges
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#B89970]">
                    Scan QR / open GPay, PhonePe, Paytm, and paste UTR code.
                  </p>
                  <p className="mt-2 text-[11px] font-semibold text-[#8B7355]">
                    Requires manual dairy verification (1-2 hours)
                  </p>
                </div>
              </button>

              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[#B89970]">
                <Info size={12} className="flex-shrink-0" />
                Payments are securely processed and protected.
              </div>
            </div>
          </div>
        </div>
      )}

      {upiIntent && (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-[rgba(20,10,4,0.58)] px-0 py-0 sm:items-center sm:px-4 sm:py-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] bg-white shadow-[0_30px_90px_rgba(30,16,8,0.24)] sm:rounded-[24px] animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">
            <div className="flex items-start justify-between gap-4 border-b border-[#F2EAE0] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8641A]">
                  Direct UPI Payment
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-[#1E1008]" style={headingFont}>
                  Pay {fmtCurrency(upiIntent.amount)} to {upiIntent.beneficiary?.dairyName || "Dairy"}
                </h3>
                <p className="mt-1 text-sm text-[#8B7355]">
                  Complete payment in your UPI app, then submit the UTR/reference number for dairy verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUpiIntent(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2EB] text-[#8B7355] transition hover:bg-[#EDE4D8]"
                aria-label="Close UPI payment"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-2xl border border-[#EDE8DF] bg-[#FFFDF8] p-4 text-center">
                <div className="mx-auto inline-flex rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG value={upiIntent.upiLink} size={196} includeMargin />
                </div>
                <p className="mt-3 break-words text-xs font-semibold text-[#7B6247]">
                  {upiIntent.beneficiary?.upiId}
                </p>
                <p className="mt-1 text-[11px] text-[#B89970]">Scan with any UPI app</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["UPI App", upiIntent.intents?.upi],
                    ["Google Pay", upiIntent.intents?.googlePay],
                    ["PhonePe", upiIntent.intents?.phonePe],
                    ["Paytm", upiIntent.intents?.paytm],
                  ].map(([label, href]) => (
                    <a
                      key={label}
                      href={href}
                      className="rounded-xl border border-[#E5DCCF] bg-[#FAFAF7] px-3 py-3 text-center text-xs font-black text-[#5C3D1E] no-underline transition-all duration-150 hover:-translate-y-0.5 hover:border-[#B8641A] hover:bg-[#FFF3E2] hover:shadow-sm active:translate-y-0"
                    >
                      {label}
                    </a>
                  ))}
                </div>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A88763]">
                    UTR / Reference Number
                  </span>
                  <input
                    value={upiForm.utrNumber}
                    onChange={(event) =>
                      setUpiForm((prev) => ({ ...prev, utrNumber: event.target.value.toUpperCase() }))
                    }
                    placeholder="Enter UPI reference number"
                    className="mt-2 w-full rounded-xl border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A88763]">
                    Your UPI ID Optional
                  </span>
                  <input
                    value={upiForm.payerUpiId}
                    onChange={(event) => setUpiForm((prev) => ({ ...prev, payerUpiId: event.target.value }))}
                    placeholder="name@bank"
                    className="mt-2 w-full rounded-xl border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E] outline-none focus:border-[#B8641A] focus:ring-4 focus:ring-[#F4E1CB]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-[#A88763]">
                    Payment Screenshot Optional
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      handleScreenshotSelected(event.target.files?.[0] || null)
                    }
                    className="mt-2 w-full rounded-xl border border-[#E7DAC6] bg-white px-4 py-3 text-sm font-semibold text-[#2C1A0E]"
                  />
                </label>

                {(ocrPreviewing || ocrPreview) && (
                  <div className="rounded-xl border border-[#E7DAC6] bg-[#FFF8F0] px-4 py-3 text-xs text-[#6B5135]">
                    {ocrPreviewing ? (
                      <span className="inline-flex items-center gap-2 font-bold">
                        <Loader2 size={13} className="animate-spin" />
                        Reading screenshot...
                      </span>
                    ) : (
                      <>
                        <p className="font-black uppercase tracking-[0.12em] text-[#B8641A]">
                          OCR {ocrPreview?.status || "READY"}
                        </p>
                        <p className="mt-1 leading-5">
                          Confidence {Number(ocrPreview?.confidence || 0)}%
                          {ocrPreview?.extracted?.appName ? ` • ${ocrPreview.extracted.appName}` : ""}
                          {ocrPreview?.extracted?.amount ? ` • ${fmtCurrency(ocrPreview.extracted.amount)}` : ""}
                        </p>
                        {ocrPreview?.error ? (
                          <p className="mt-1 text-[#C53030]">{ocrPreview.error}</p>
                        ) : null}
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSubmitUpiVerification}
                  disabled={submittingVerification}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2C1A0E] px-5 py-3 text-sm font-black text-white transition-all duration-150 hover:bg-[#B8641A] active:scale-[0.99] disabled:bg-[#D8C8B2] disabled:scale-100"
                >
                  {submittingVerification ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  Submit For Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
};

export default Subscribe;

/* ======================================================
   SUB-COMPONENTS (Styling & Layout)
====================================================== */

const StatCard = ({ icon, label, value }) => (
  <div className="flex min-w-0 items-center gap-3 rounded-[20px] border border-[#EDE8DF] bg-[#FFFDF7] p-4 shadow-sm transition hover:shadow-md sm:gap-4 sm:rounded-[22px] sm:p-7">
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFF4E2] text-[#B8641A] sm:h-14 sm:w-14">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-[0.16em] text-[#C4A882] sm:text-xs">{label}</p>
      <p className="mt-1 break-words text-base font-semibold leading-snug text-[#2C1A0E] sm:text-lg">{value}</p>
    </div>
  </div>
);

const ExploreOtherDairiesSection = ({ onExplore }) => (
  <section className="rounded-[22px] border border-[#EFD7B3] bg-[linear-gradient(135deg,#FFF8EC_0%,#FFF1E4_100%)] p-5 sm:rounded-[24px] sm:p-6 md:p-7">
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[14px] border border-[#EFD7B3] bg-white text-[#B8641A]">
          <Store size={22} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[24px] font-semibold leading-tight text-[#2C1A0E] sm:text-[28px]" style={headingFont}>Explore Other Dairies</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-[#8B7355]">
            Compare dairies, check plans, and switch to a better option anytime.
          </p>
        </div>
      </div>
      <button
        onClick={onExplore}
        className="min-h-[46px] w-full rounded-[14px] bg-[#2C2416] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#4A3820] md:w-auto"
      >
        Browse Dairies
      </button>
    </div>
  </section>
);

const ModalWrapper = ({ children, small }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-6">
    <div
      className={`my-auto w-full max-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden animate-in zoom-in-95 border border-[#EDE8DF] bg-[#FFFDF7] shadow-2xl sm:max-h-[calc(100vh-3rem)] ${
        small ? 'max-w-md rounded-[24px] sm:rounded-[28px]' : 'max-w-2xl rounded-[24px] sm:rounded-[28px]'
      }`}
    >
      {children}
    </div>
  </div>
);

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="flex items-start justify-between gap-4 border-b border-[#F2EDE4] px-5 py-4 sm:px-8 sm:py-5">
    <div>
      <h3 className="text-2xl font-semibold text-[#2C1A0E]" style={headingFont}>{title}</h3>
      <p className="mt-1 text-sm text-[#8B7355]">{subtitle}</p>
    </div>
    <button onClick={onClose} className="rounded-full p-2 transition hover:bg-[#FBF7F0]">
      <X size={22} className="text-[#A88763]" />
    </button>
  </div>
);

const ModalFooter = ({ onCancel, onConfirm, confirmText }) => (
  <div className="flex flex-col-reverse gap-3 border-t border-[#F2EDE4] px-5 py-4 sm:flex-row sm:justify-end sm:gap-4 sm:px-8 sm:py-5">
    <button onClick={onCancel} className="rounded-[14px] border border-[#EDE8DF] px-6 py-2 transition hover:bg-[#FBF7F0]">
      Cancel
    </button>
    <button onClick={onConfirm} className="rounded-[14px] bg-[#B8641A] px-8 py-2 text-white transition hover:bg-[#9F5313]">
      {confirmText}
    </button>
  </div>
);

const InputBlock = ({ label, children }) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-[#8B7355]">{label}</label>
    {children}
  </div>
);
