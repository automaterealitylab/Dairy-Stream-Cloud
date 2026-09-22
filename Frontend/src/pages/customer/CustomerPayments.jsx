import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  Filter,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  Smartphone,
  Wallet,
  X,
  XCircle,
} from "lucide-react";

import CustomerLayout from "../../components/customer/layouts/CustomerLayout";
import LoadingIndicator from "../../components/common/LoadingIndicator.jsx";
import {
  createCustomerUpiPaymentIntent,
  previewCustomerPaymentScreenshotOcr,
  submitCustomerUpiPaymentVerification,
  createCustomerPaymentOrder,
  verifyCustomerPayment,
  createCustomerWalletTopupOrder,
  verifyCustomerWalletTopup,
  payCustomerBillWithWallet,
  downloadCustomerInvoicePdfBlob,
} from "../../api/customer/customer.api.js";
import { loadRazorpayCheckout } from "../../utils/loadRazorpay.js";
import { PaymentRow } from "../../components/customer/payments/PaymentRow.jsx";
import { useCustomerPayments } from "../../hooks/useCustomerPayments.js";
import {
  bodyFont,
  headingFont,
  FILTER_OPTIONS,
  WALLET_TOPUP_PRESETS,
  INITIAL_SHOW,
  fmt,
  formatPaymentMethodLabel,
  formatDateLabel,
  dueText,
  parseTitle,
  statusCfg,
  paymentTypeCfg,
  getMonthEndDate,
  getNextSubscriptionDueDate,
} from "../../utils/customerPayments.js";

export default function Payments() {
  const {
    summary,
    history,
    loading,
    error,
    setError,
    loadPayments,
  } = useCustomerPayments();

  const [payingPaymentId, setPayingPaymentId] = useState(null);
  const [walletTopupAmount, setWalletTopupAmount] = useState("250");
  const [walletTopupLoading, setWalletTopupLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [upiIntent, setUpiIntent] = useState(null);
  const [upiForm, setUpiForm] = useState({ utrNumber: "", payerUpiId: "", screenshotFile: null });
  const [ocrPreview, setOcrPreview] = useState(null);
  const [ocrPreviewing, setOcrPreviewing] = useState(false);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [detailPayment, setDetailPayment] = useState(null);
  const itemsPerPage = 8;
  const [paymentSelectorOpen, setPaymentSelectorOpen] = useState(false);
  const [selectedPaymentTarget, setSelectedPaymentTarget] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [downloadingPdfId, setDownloadingPdfId] = useState(null);

  const handleDownloadPdf = async (payment) => {
    const invoiceId = payment?.monthly_bill_id || payment?.monthlyBillId || payment?.id;
    if (!invoiceId) return;

    try {
      setDownloadingPdfId(invoiceId);
      await downloadCustomerInvoicePdfBlob(invoiceId);
    } catch (error) {
      console.error("PDF download failed:", error);
      alert(error?.response?.data?.message || "Unable to generate/download the bill right now. Please try again.");
    } finally {
      setDownloadingPdfId(null);
    }
  };

  const beneficiary = summary?.beneficiary;
  const hasRazorpay = Boolean(beneficiary?.subscriptionAcceptRazorpay);
  const hasUpi = Boolean(beneficiary?.subscriptionAcceptDirectUpi);
  const preferredMethod = beneficiary?.subscriptionPaymentMethod || (hasRazorpay ? "RAZORPAY" : "DIRECT_UPI");

  useEffect(() => {
    setShowAll(false);
    setCurrentPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (!walletModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setWalletModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [walletModalOpen]);

  const handlePayNow = (payment, { payAll = false } = {}) => {
    if (!payAll && !payment?.id) {
      setError("No pending payment selected.");
      return;
    }
    const totalPayableAmount = Number(summary.monthlyDue || 0) > 0
      ? Number(summary.monthlyDue)
      : Number(summary.billingSummaryAmount || summary.payableTillDate || 0);

    if (payAll && totalPayableAmount <= 0) {
      setError("Nothing to pay.");
      return;
    }

    const target = { payment, payAll };
    const paymentAmount = payAll ? totalPayableAmount : Number(payment?.amount || 0);
    const hasSufficientWallet = Number(summary.walletBalance || 0) >= paymentAmount && paymentAmount > 0;

    if (hasSufficientWallet || (hasRazorpay && hasUpi)) {
      setSelectedPaymentTarget(target);
      setPaymentSelectorOpen(true);
      setError(null);
      return;
    }

    if (hasUpi && !hasRazorpay) {
      handleExecuteUpiPayment(target);
    } else if (hasRazorpay && !hasUpi) {
      handleExecuteRazorpayPayment(target);
    } else if (preferredMethod === "DIRECT_UPI") {
      handleExecuteUpiPayment(target);
    } else {
      handleExecuteRazorpayPayment(target);
    }
  };

  const handleExecuteUpiPayment = async (targetOverride) => {
    const target = targetOverride || selectedPaymentTarget;
    if (!target) return;
    const { payment, payAll } = target;
    setPaymentSelectorOpen(false);

    try {
      setPayingPaymentId(payAll ? "__ALL__" : payment.id);
      setError(null);

      const payload = payAll || !payment?.id || String(payment.id).startsWith("payment-")
        ? { payAll: true, includeRunningDue: true }
        : { paymentId: payment.id, includeRunningDue: true };

      const intentPayload = await createCustomerUpiPaymentIntent(payload);
      setUpiIntent({ ...intentPayload, payAll, paymentId: payment?.id || null });
      setUpiForm({ utrNumber: "", payerUpiId: "", screenshotFile: null });
      setOcrPreview(null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to start UPI payment.");
    } finally {
      setPayingPaymentId(null);
      setSelectedPaymentTarget(null);
    }
  };

  const handleExecuteRazorpayPayment = async (targetOverride) => {
    const target = targetOverride || selectedPaymentTarget;
    if (!target) return;
    const { payment, payAll } = target;
    setPaymentSelectorOpen(false);
    setPaymentProcessing(true);
    setError(null);

    try {
      const isLoaded = await loadRazorpayCheckout();
      if (!isLoaded) {
        throw new Error("Failed to load Razorpay SDK. Please check your network connection.");
      }

      const payload = payAll || !payment?.id || String(payment.id).startsWith("payment-")
        ? { payAll: true, includeRunningDue: true }
        : { paymentId: payment.id, includeRunningDue: true };

      const orderData = await createCustomerPaymentOrder(payload);

      const { keyId, order } = orderData;

      if (order.id.startsWith("order_mock_")) {
        setPaymentProcessing(true);
        try {
          await verifyCustomerPayment({
            paymentId: payment?.id || null,
            payAll,
            includeRunningDue: true,
            razorpayOrderId: order.id,
            razorpayPaymentId: `pay_mock_${Math.random().toString(36).substr(2, 9)}`,
            razorpaySignature: "mock_signature",
          });
          await loadPayments({ force: true });
        } catch (err) {
          setError(err?.response?.data?.message || err?.message || "Payment verification failed.");
        } finally {
          setPaymentProcessing(false);
          setSelectedPaymentTarget(null);
        }
        return;
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "DairyVision",
        description: payAll ? "Clear Pending Bills" : (payment.title || "Dairy Bill"),
        order_id: order.id,
        prefill: {
          name: summary.beneficiary?.customerName || "",
          email: summary.beneficiary?.customerEmail || "",
          contact: summary.beneficiary?.customerPhone || "",
        },
        theme: {
          color: "#B8641A",
        },
        handler: async (response) => {
          setPaymentProcessing(true);
          try {
            await verifyCustomerPayment({
              paymentId: payment?.id || null,
              payAll,
              includeRunningDue: true,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await loadPayments({ force: true });
          } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Payment verification failed.");
          } finally {
            setPaymentProcessing(false);
            setSelectedPaymentTarget(null);
          }
        },
        modal: {
          ondismiss: () => {
            setPaymentProcessing(false);
            setSelectedPaymentTarget(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to start Online payment.");
      setPaymentProcessing(false);
    }
  };

  const handleExecuteWalletPayment = async (targetOverride) => {
    const target = targetOverride || selectedPaymentTarget;
    if (!target) return;
    const { payment, payAll } = target;
    setPaymentSelectorOpen(false);
    setPaymentProcessing(true);
    setError(null);

    try {
      await payCustomerBillWithWallet(
        payAll ? { payAll: true, includeRunningDue: false } : { paymentId: payment.id }
      );
      await loadPayments({ force: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Wallet payment failed.");
    } finally {
      setPaymentProcessing(false);
      setSelectedPaymentTarget(null);
    }
  };


  const handleWalletTopup = async () => {
    const value = Number(walletTopupAmount);
    if (!Number.isFinite(value) || value < 10) {
      setError("Minimum wallet top-up amount is ₹10.");
      return;
    }

    setWalletModalOpen(false);
    setWalletTopupLoading(true);
    setError(null);

    try {
      const isLoaded = await loadRazorpayCheckout();
      if (!isLoaded) {
        throw new Error("Failed to load Razorpay SDK. Please check your network connection.");
      }

      const orderData = await createCustomerWalletTopupOrder({
        amount: value,
      });

      const { keyId, order } = orderData;

      if (order.id.startsWith("order_mock_")) {
        setWalletTopupLoading(true);
        try {
          await verifyCustomerWalletTopup({
            amount: value,
            razorpayOrderId: order.id,
            razorpayPaymentId: `pay_mock_${Math.random().toString(36).substr(2, 9)}`,
            razorpaySignature: "mock_signature",
          });
          await loadPayments({ force: true });
        } catch (err) {
          setError(err?.response?.data?.message || err?.message || "Wallet top-up verification failed.");
        } finally {
          setWalletTopupLoading(false);
        }
        return;
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: "DairyVision Wallet",
        description: `Wallet Topup \u2022 \u20B9${value}`,
        order_id: order.id,
        theme: {
          color: "#3B6D11",
        },
        handler: async (response) => {
          setWalletTopupLoading(true);
          try {
            await verifyCustomerWalletTopup({
              amount: value,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            await loadPayments({ force: true });
          } catch (err) {
            setError(err?.response?.data?.message || err?.message || "Wallet top-up verification failed.");
          } finally {
            setWalletTopupLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setWalletTopupLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to process wallet top-up.");
      setWalletTopupLoading(false);
    }
  };

  const handleSubmitUpiVerification = async () => {
    try {
      if (!upiIntent) return;
      if (!String(upiForm.utrNumber || "").trim()) {
        throw new Error("Enter the UTR/reference number after payment.");
      }

      setSubmittingVerification(true);
      setError(null);
      await submitCustomerUpiPaymentVerification({
        paymentId: upiIntent.paymentId || "",
        payAll: upiIntent.payAll ? "true" : "false",
        includeRunningDue: upiIntent.isWalletTopup ? "false" : "true",
        isWalletTopup: upiIntent.isWalletTopup ? "true" : "false",
        amount: upiIntent.amount,
        utrNumber: upiForm.utrNumber,
        payerUpiId: upiForm.payerUpiId,
        screenshotFile: upiForm.screenshotFile,
      });
      setUpiIntent(null);
      await loadPayments({ force: true });
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Unable to submit verification.");
    } finally {
      setSubmittingVerification(false);
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

  const nextUnpaidPayment =
    history.find((payment) =>
      ["PENDING", "OVERDUE"].includes(String(payment.status || "").toUpperCase())
    ) ?? null;

  const isOverdue = summary.dueInDays !== null && summary.dueInDays < 0;
  const totalPayableNow = Number(summary.monthlyDue || 0) > 0
    ? Number(summary.monthlyDue)
    : Number(summary.billingSummaryAmount || summary.payableTillDate || 0);
  const hasDue = totalPayableNow > 0;
  const walletTopupValue = Number(walletTopupAmount);
  const canTopupWallet = Number.isFinite(walletTopupValue) && walletTopupValue >= 10;
  const walletTopupButtonLabel =
    walletTopupLoading || !canTopupWallet ? "Add Money" : `Add ${fmt(walletTopupValue)}`;
  const projectedWalletBalance = summary.walletBalance + (canTopupWallet ? walletTopupValue : 0);
  const isBusy = Boolean(payingPaymentId) || walletTopupLoading || loading || paymentProcessing;
  const hasRunningSubscriptionBill = Number(summary.payableTillDate || 0) > 0;
  const subscriptionDueDateLabel = formatDateLabel(getNextSubscriptionDueDate(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const heroAmount = hasDue ? totalPayableNow : summary.billingSummaryAmount;
  const heroLabel = hasDue
    ? "Amount Due Now"
    : hasRunningSubscriptionBill
    ? "Running Subscription Bill"
    : "Amount Due This Month";
  const billingSummaryHelper = hasDue
    ? dueText(summary.dueInDays)
    : hasRunningSubscriptionBill
    ? "Subscription deliveries are billed monthly and due by the 10th of next month"
    : "No delivered items billed yet";

  const payeeText = summary.beneficiary?.dairyName
    ? `${summary.beneficiary.dairyName}${
        summary.beneficiary.bankName ? ` \u2022 ${summary.beneficiary.bankName}` : ""
      }`
    : "Payee details will appear here";

  const heroTagClasses = isOverdue
    ? "border border-[#dc262640] bg-[#dc262626] text-[#fecaca]"
    : hasDue
    ? "border border-[#f59e0b40] bg-[#f59e0b21] text-[#FDE68A]"
    : "border border-white/10 bg-white/10 text-white/70";

  const payAllButtonClasses =
    hasDue
      ? "bg-[#B8641A] text-white hover:bg-[#9F5414] disabled:bg-white/12 disabled:text-white/40"
      : "bg-white/12 text-white/40 hover:bg-white/12 disabled:bg-white/12 disabled:text-white/40";

  const filteredHistory = history.filter((payment) => {
    if (statusFilter === "ALL") return true;
    return String(payment.status || "").toUpperCase() === statusFilter;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleHistory = filteredHistory.slice(startIndex, startIndex + itemsPerPage);
  const startItem = filteredHistory.length > 0 ? startIndex + 1 : 0;
  const endItem = Math.min(startIndex + itemsPerPage, filteredHistory.length);
  const nextBillDateLabel = formatDateLabel(getMonthEndDate(), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const nextBillHint = "Monthly bill closes at the end of the month";
  const overdueHelperText =
    Number(summary.overduePenaltyAmount || 0) > 0
      ? `${fmt(summary.overdueBaseAmount)} + ${fmt(summary.overduePenaltyAmount)}`
      : "Increases only after the 10th if unpaid";
  const lastMonthBillText =
    Number(summary.overdueBaseAmount || 0) > 0
      ? `Last month bill: ${fmt(summary.overdueBaseAmount)}`
      : "No unpaid bill from last month";
  const overdueCarryForwardText =
    Number(summary.overdueAmount || 0) > 0
      ? "This overdue stays added until that bill is paid"
      : "No overdue is being carried forward";

  const showOnlinePay = hasRazorpay;
  const showDirectUpi = hasUpi;

  const selectedTargetPayment = selectedPaymentTarget?.payment || {};
  const selectedPaymentAmount = selectedPaymentTarget?.payAll
    ? Number(summary.monthlyDue || 0)
    : Number(selectedTargetPayment.amount || 0);

  const showWalletPay = Number(summary.walletBalance || 0) >= selectedPaymentAmount && selectedPaymentAmount > 0;

  if (paymentSelectorOpen && selectedPaymentTarget) {
    console.log("[PAYMENT DEBUG]", {
      paymentModalAmount: selectedPaymentTarget.payAll ? summary.monthlyDue : selectedPaymentTarget.payment?.amount,
      sourceVariable: selectedPaymentTarget.payAll ? "summary.monthlyDue" : "selectedPaymentTarget.payment.amount",
      monthlyDue: summary.monthlyDue,
      billingSummaryAmount: summary.billingSummaryAmount,
      payableTillDate: summary.payableTillDate,
      walletBalance: summary.walletBalance,
      selectedPaymentTarget,
      dairyId: summary.beneficiary?.dairyId,
    });
  }

  return (
    <CustomerLayout>
      <div className="w-full px-0 py-4 sm:px-2 sm:py-6 md:px-4 lg:py-10" style={bodyFont}>
        <div className="rounded-[24px] border border-[#E5DCCF] bg-[#F5EFE6] p-4 shadow-[0_18px_60px_rgba(84,52,16,0.08)] sm:rounded-[30px] sm:p-7 lg:p-9 xl:p-10">
          <div className="space-y-5 sm:space-y-6 lg:space-y-7">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h2
                  className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[#2C1A0E] sm:text-[34px]"
                  style={headingFont}
                >
                  My <span className="text-[#B8641A]">Payments</span>
                </h2>

                <button
                  onClick={() => loadPayments({ force: true })}
                  disabled={loading}
                  className="inline-flex h-9 flex-shrink-0 items-center justify-center gap-1.5 self-start rounded-[10px] border border-[#E5DCCF] bg-white px-3 text-xs font-semibold text-[#8B7355] transition hover:border-[#D8C5AA] hover:text-[#5C3D1E] disabled:opacity-50 sm:h-10 sm:px-3.5 sm:text-sm"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {loading ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <p className="mt-1.5 max-w-xl text-sm leading-6 text-[#B89970]">
                Track bills, wallet credits, and recent payments in one place.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#C53030]">
                <XCircle size={15} className="mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <section className="relative overflow-hidden rounded-[20px] bg-[#2C1A0E] px-4 py-5 sm:rounded-[22px] sm:px-8 sm:py-6 lg:px-9 lg:py-8">
              <div className="absolute -right-8 -top-10 h-52 w-52 rounded-full bg-[rgba(184,100,26,0.15)]" />
              <div className="absolute bottom-[-52px] right-20 h-36 w-36 rounded-full bg-[rgba(245,200,122,0.08)]" />

              <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 max-w-xl">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#F5C87A73]">
                    {heroLabel}
                  </p>
                  <h3
                    className="mt-2 break-words text-[28px] font-semibold leading-none tracking-[-0.04em] text-white sm:text-[52px]"
                    style={headingFont}
                  >
                    {fmt(heroAmount)}
                  </h3>

                  <div className="mt-4">
                    <span
                      className={`inline-flex max-w-full flex-wrap items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold leading-5 ${heroTagClasses}`}
                    >
                      <Clock size={12} />
                      {billingSummaryHelper}
                    </span>
                  </div>
                </div>

                <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:w-auto lg:flex-col lg:items-end">
                  <div className="min-w-0">
                    <p className="text-[11px] text-white/40 lg:text-right">Pay to</p>
                    <p className="mt-1 break-words text-sm font-bold leading-6 text-white/85 lg:max-w-[260px] lg:text-right">
                      {payeeText}
                    </p>
                  </div>

                  <button
                    onClick={() => handlePayNow(nextUnpaidPayment, { payAll: true })}
                    disabled={isBusy || !hasDue}
                    className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] px-5 py-3 text-sm font-extrabold transition sm:w-auto lg:min-w-[200px] ${payAllButtonClasses}`}
                  >
                    {payingPaymentId === "__ALL__" || (paymentProcessing && selectedPaymentTarget?.payAll) ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <CreditCard size={15} />
                    )}
                    {payingPaymentId === "__ALL__" || (paymentProcessing && selectedPaymentTarget?.payAll)
                      ? "Processing..."
                      : `Pay Now ${fmt(totalPayableNow)}`}
                  </button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 [grid-auto-rows:1fr] sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FDE9C9] text-[#B8641A]">
                  <Wallet size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Wallet Balance
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#4A7C2F] sm:text-[26px]"
                  style={headingFont}
                >
                  {fmt(summary.walletBalance)}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-[#B89970] sm:mt-2 sm:text-[11px] sm:leading-5">
                  Available for payments
                </p>
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(true)}
                  className="mt-auto inline-flex min-h-[34px] items-center gap-1.5 self-start rounded-[9px] border border-[#C0DD97] bg-[#EAF3DE] px-2.5 py-1.5 text-[10px] font-bold text-[#3B6D11] transition hover:bg-[#D9EDBE] sm:min-h-[40px] sm:px-3 sm:text-xs"
                >
                  <Plus size={12} />
                  Add Money
                </button>
              </div>

              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#FDECEA] text-[#C0392B]">
                  <CreditCard size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Overdue
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#C0392B] sm:text-[26px]"
                  style={headingFont}
                >
                  {fmt(summary.overdueAmount)}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-[#B89970] sm:mt-2 sm:text-[11px] sm:leading-5">
                  {overdueHelperText}
                </p>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-[#8B7355] sm:text-[11px] sm:leading-5">
                  {lastMonthBillText}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[#B89970] sm:text-[11px] sm:leading-5">
                  {overdueCarryForwardText}
                </p>
              </div>

              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#EBF7F1] text-[#1A7A4A]">
                  <RefreshCw size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Subscription Bill
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#1A7A4A] sm:text-[26px]"
                  style={headingFont}
                >
                  {fmt(summary.payableTillDate)}
                </p>
                <p className="mt-1.5 text-[10px] leading-4 text-[#B89970] sm:mt-2 sm:text-[11px] sm:leading-5">
                  {hasRunningSubscriptionBill
                    ? "Running total from delivered subscription items"
                    : "Starts building as subscription deliveries are completed"}
                </p>
                <p className="mt-auto pt-2.5 text-[10px] font-semibold leading-4 text-[#8B7355] sm:pt-3 sm:text-[11px] sm:leading-5">
                  Payable by {subscriptionDueDateLabel}
                </p>
              </div>

              <div className="flex h-full min-w-0 flex-col rounded-[16px] border border-[#EDE8DF] bg-white p-3 sm:p-5">
                <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E8F4E0] text-[#4A7C2F]">
                  <CalendarDays size={16} />
                </div>
                <p className="text-[8px] font-extrabold uppercase tracking-[0.16em] text-[#C4A882] sm:text-[9px]">
                  Next Bill Date
                </p>
                <p
                  className="mt-1.5 break-words text-[18px] font-semibold leading-none tracking-[-0.04em] text-[#B8641A] sm:text-[26px]"
                  style={headingFont}
                >
                  {nextBillDateLabel}
                </p>
                <p className="mt-auto pt-2.5 text-[10px] leading-4 text-[#B89970] sm:pt-3 sm:text-[11px] sm:leading-5">
                  {nextBillHint}
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-[16px] border border-[#EDE8DF] bg-white sm:rounded-[18px]">
              <div className="flex flex-col gap-3 border-b border-[#F2EDE4] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <div>
                  <h4 className="text-base font-extrabold text-[#2C1A0E]">Recent Payments</h4>
                  <p className="mt-1 text-xs text-[#B89970]">
                    Review your latest bills, completed payments, and pending dues.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="relative w-full sm:w-auto">
                    <Filter
                      size={14}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8B7355]"
                    />
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="w-full appearance-none rounded-[10px] border border-[#EDE8DF] bg-[#FAFAF7] py-2 pl-9 pr-9 text-sm font-semibold text-[#8B7355] outline-none transition hover:border-[#D8C5AA] focus:border-[#B8641A] sm:w-auto"
                    >
                      {FILTER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8B7355]"
                    />
                  </div>

                  <span className="self-start rounded-full bg-[#FDE9C9] px-3 py-1 text-xs font-bold text-[#B8641A]">
                    {filteredHistory.length} {filteredHistory.length === 1 ? "record" : "records"}
                  </span>
                </div>
              </div>

              {loading ? (
                <div className="divide-y divide-[#EDE8DF] animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex flex-col gap-3 p-4 md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(120px,0.95fr)_minmax(130px,0.95fr)_minmax(170px,1fr)] md:gap-4 md:px-6 md:py-4 items-center">
                      <div className="flex w-full items-center gap-3 md:w-auto">
                        <div className="h-9 w-9 rounded-full bg-[#E7DAC6]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 w-32 rounded bg-[#E7DAC6]" />
                          <div className="h-3.5 w-44 rounded bg-[#E7DAC6]/60" />
                        </div>
                      </div>
                      <div className="h-4 w-20 rounded bg-[#E7DAC6]/50 self-start md:self-center" />
                      <div className="h-5 w-16 rounded-full bg-[#E7DAC6]/40 self-start md:self-center" />
                      <div className="h-5 w-24 rounded bg-[#E7DAC6] self-end md:self-center ml-auto" />
                    </div>
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#EDE8DF] bg-[#FDF6EC] text-[#B89970]">
                    <Wallet size={24} />
                  </div>
                  <p className="mt-4 text-sm font-bold text-[#5C3D1E]">
                    {history.length === 0
                      ? "No payment records yet"
                      : "No payments match this filter"}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[#B89970]">
                    {history.length === 0
                      ? "Your payment history will appear here once your first delivery is billed."
                      : "Try switching the filter to see bills from another payment status."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="hidden md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(120px,0.95fr)_minmax(130px,0.95fr)_minmax(170px,1fr)] md:gap-4 md:bg-[#FAFAF7] md:px-6 md:py-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Description
                    </p>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Date
                    </p>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Status
                    </p>
                    <p className="text-right text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#C4A882]">
                      Amount
                    </p>
                  </div>

                  {visibleHistory.map((payment) => {
                    const cfg = statusCfg(payment.status);
                    const typeCfg = paymentTypeCfg(payment.title);
                    const normalizedStatus = String(payment.status || "").toUpperCase();
                    const verificationStatus = String(payment.verificationStatus || "").toUpperCase();
                    const isUnpaid = ["PENDING", "OVERDUE"].includes(normalizedStatus);
                    const isPaid = normalizedStatus === "PAID";
                    const isPendingVerification = isPaid && verificationStatus === "SUBMITTED";
                    const { title, subtitle } = parseTitle(payment.title || "");
                    const paymentDateLabel = formatDateLabel(payment.date) || payment.date || "-";
                    const paymentMethodLabel = formatPaymentMethodLabel(payment.method);
                    const subtitleHasPaymentDate =
                      subtitle && paymentDateLabel && paymentDateLabel !== "-"
                        ? subtitle.includes(paymentDateLabel)
                        : false;
                    const paymentStatusMeta = isUnpaid
                      ? payment.dueDate
                        ? dueText(
                            Math.round(
                              (new Date(payment.dueDate).getTime() - new Date().getTime()) /
                                (1000 * 60 * 60 * 24)
                            )
                          )
                        : "Due date not set"
                      : `${paymentMethodLabel ? `${paymentMethodLabel} payment` : "Recorded payment"}${
                          isPendingVerification ? " - Pending verification" : ""
                        }`;
                    const mobileMeta = [
                      !subtitleHasPaymentDate && paymentDateLabel !== "-" ? paymentDateLabel : "",
                      !isPaid ? paymentMethodLabel : "",
                    ]
                      .filter(Boolean)
                      .join(" \u2022 ");

                    return (
                      <PaymentRow
                        key={payment.id}
                        payment={payment}
                        cfg={cfg}
                        typeCfg={typeCfg}
                        title={title}
                        subtitle={subtitle}
                        paymentDateLabel={paymentDateLabel}
                        onRowClick={(p) => setDetailPayment(p)}
                        onDownloadPdf={(p) => handleDownloadPdf(p)}
                      />
                    );
                  })}

                  {filteredHistory.length > itemsPerPage && (
                    <div className="flex flex-col gap-3 border-t border-[#F2EDE4] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
                      <p className="text-xs text-[#8B7355]">
                        Showing <span className="font-bold text-[#2C1A0E]">{startItem}-{endItem}</span> of{" "}
                        <span className="font-bold text-[#2C1A0E]">{filteredHistory.length}</span> payments
                      </p>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#EDE8DF] bg-white px-3.5 py-1.5 text-xs font-bold text-[#5C3D1E] transition hover:border-[#D4B896] hover:bg-[#FAF5EF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ChevronLeft size={14} /> Previous
                        </button>

                        <span className="text-xs font-semibold text-[#8B7355] px-2">
                          Page {currentPage} of {totalPages || 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          disabled={currentPage >= totalPages}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#EDE8DF] bg-white px-3.5 py-1.5 text-xs font-bold text-[#5C3D1E] transition hover:border-[#D4B896] hover:bg-[#FAF5EF] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Next <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      {upiIntent && (
        <div className="fixed inset-0 z-[92] flex items-end justify-center bg-[rgba(20,10,4,0.58)] px-0 py-0 sm:items-center sm:px-4 sm:py-6 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] bg-white shadow-[0_30px_90px_rgba(30,16,8,0.24)] sm:rounded-[24px] animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">
            <div className="flex items-start justify-between gap-4 border-b border-[#F2EAE0] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#B8641A]">
                  Direct UPI Payment
                </p>
                <h3 className="mt-1 text-2xl font-semibold text-[#1E1008]" style={headingFont}>
                  Pay {fmt(upiIntent.amount)} to {upiIntent.beneficiary?.dairyName || "Dairy"}
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
                          {ocrPreview?.extracted?.amount ? ` • ${fmt(ocrPreview.extracted.amount)}` : ""}
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

      {paymentSelectorOpen && selectedPaymentTarget && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-[rgba(20,10,4,0.58)] px-0 py-0 sm:items-center sm:px-4 sm:py-6 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPaymentSelectorOpen(false);
              setSelectedPaymentTarget(null);
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
                  Pay {fmt(selectedPaymentTarget.payAll ? summary.monthlyDue : selectedPaymentTarget.payment?.amount)}
                </h3>
                <p className="mt-1 text-xs text-[#8B7355]">
                  Choose how you'd like to pay your dairy bill.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentSelectorOpen(false);
                  setSelectedPaymentTarget(null);
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
              {showOnlinePay && (
                <button
                  type="button"
                  onClick={() => handleExecuteRazorpayPayment()}
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
              )}

              {/* Option B: Direct UPI Intent/UTR */}
              {showDirectUpi && (
                <button
                  type="button"
                  onClick={() => handleExecuteUpiPayment()}
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
              )}

              {/* Option C: Pay with Wallet */}
              {showWalletPay && (
                <button
                  type="button"
                  onClick={() => handleExecuteWalletPayment()}
                  className="group w-full flex items-start gap-4 rounded-[16px] border border-[#E5DCCF] bg-[#FFFDF9] p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#B8641A] hover:bg-[#FFF8EE] hover:shadow-md active:translate-y-0"
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[12px] bg-[#EFF6FF] text-[#1D5FA5] transition group-hover:bg-[#1D5FA5] group-hover:text-white">
                    <Wallet size={20} className="transition" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-[#2C1A0E]">Pay using Wallet</span>
                      <span className="inline-flex items-center rounded-full bg-[#EBF7F1] px-2.5 py-0.5 text-[9px] font-bold text-[#1A7A4A]">
                        Balance: {fmt(summary.walletBalance)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#B89970]">
                      Deduct instantly from your platform wallet balance.
                    </p>
                    <p className="mt-2 text-[11px] font-semibold text-[#1A7A4A]">
                      Instant settlement & confirmation
                    </p>
                  </div>
                </button>
              )}

              <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-[#B89970]">
                <Info size={12} className="flex-shrink-0" />
                Payments are securely processed and protected.
              </div>
            </div>
          </div>
        </div>
      )}

      {walletModalOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-[rgba(20,10,4,0.55)] px-0 py-0 sm:items-center sm:px-4 sm:py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setWalletModalOpen(false);
            }
          }}
        >
          <div className="h-[100svh] w-full max-w-[420px] overflow-hidden rounded-none bg-white shadow-[0_30px_90px_rgba(30,16,8,0.24)] sm:h-auto sm:max-h-[92vh] sm:rounded-[22px]">
            <div className="h-[3px] w-full bg-[linear-gradient(90deg,#3B6D11_0%,#97C459_100%)]" />

            <div className="border-b border-[#F2EAE0] px-5 pb-5 pt-6 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#EAF3DE] text-[#3B6D11]">
                    <Wallet size={20} />
                  </div>
                  <h3
                    className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-[#1E1008]"
                    style={headingFont}
                  >
                    Add Money to Wallet
                  </h3>
                  <p className="mt-2 text-sm text-[#B89970]">
                    Recharge instantly {"\u2022"} Used for future bills {"\u2022"} Min. {fmt(10)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F7F2EB] text-[#8B7355] transition hover:bg-[#EDE4D8]"
                  aria-label="Close wallet top-up"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto px-5 py-6 sm:px-6">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Quick Select
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {WALLET_TOPUP_PRESETS.map((amount) => {
                    const selected = walletTopupAmount === String(amount);

                    return (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setWalletTopupAmount(String(amount))}
                        className={`rounded-[10px] border px-3 py-2.5 text-sm font-bold transition ${
                          selected
                            ? "border-[#3B6D11] bg-[#EAF3DE] text-[#3B6D11]"
                            : "border-[#EDE8DF] bg-[#FAFAF7] text-[#8B7355] hover:border-[#B8641A] hover:bg-[#FEF6EC] hover:text-[#B8641A]"
                        }`}
                      >
                        {fmt(amount)}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#C4A882]">
                  Or Enter Custom Amount
                </p>
                <label className="relative block">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base font-semibold text-[#8B7355]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    inputMode="decimal"
                    value={walletTopupAmount}
                    onChange={(event) => setWalletTopupAmount(event.target.value)}
                    placeholder="Enter amount"
                    className="w-full rounded-[11px] border-[1.5px] border-[#EDE8DF] bg-[#FAFAF7] py-3 pl-8 pr-4 text-base font-semibold text-[#1E1008] outline-none transition placeholder:font-normal placeholder:text-[#C4A882] focus:border-[#3B6D11]"
                  />
                </label>
              </div>

              <div className="flex flex-col gap-2 rounded-[11px] border border-[#C0DD97] bg-[#F0F8E8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-[#4A7C2F]">
                  Current balance {"\u2192"} New balance after top-up
                </p>
                <p
                  className="text-[24px] font-semibold leading-none tracking-[-0.03em] text-[#3B6D11]"
                  style={headingFont}
                >
                  {fmt(projectedWalletBalance)}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[#B89970]">
                <Info size={13} />
                Amount will be credited instantly to your DairyVision wallet.
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="rounded-[11px] border border-[#EDE4D8] bg-[#F7F2EB] px-4 py-3 text-sm font-bold text-[#8B7355] transition hover:bg-[#EDE4D8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleWalletTopup}
                  disabled={loading || walletTopupLoading || !canTopupWallet}
                  className="inline-flex items-center justify-center gap-2 rounded-[11px] bg-[#1E1008] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#3B6D11] disabled:cursor-not-allowed disabled:bg-[#D4C4A8] disabled:text-[#8B7355]"
                >
                  {walletTopupLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  {walletTopupLoading ? "Preparing..." : walletTopupButtonLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {detailPayment && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setDetailPayment(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-[#EDE8DF] bg-[#FFFDF7] p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F2EDE4]">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C4A882]">
                  Payment Details
                </p>
                <h3 className="text-lg font-bold text-[#2C1A0E] mt-0.5">
                  {parseTitle(detailPayment.title).title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailPayment(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#EDE8DF] bg-white text-[#8B7355] hover:bg-[#FAF5EF] font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-[#5C3D1E]">
              <div className="flex justify-between py-1.5 border-b border-[#F2EDE4]">
                <span className="text-[#8B7355]">Amount</span>
                <span className="font-bold text-base text-[#2C1A0E]" style={headingFont}>
                  {fmt(detailPayment.amount)}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#F2EDE4]">
                <span className="text-[#8B7355]">Status</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusCfg(detailPayment.status).pill}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusCfg(detailPayment.status).dot}`} />
                  {statusCfg(detailPayment.status).label}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#F2EDE4]">
                <span className="text-[#8B7355]">Date</span>
                <span className="font-semibold">{formatDateLabel(detailPayment.date) || "-"}</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-[#F2EDE4]">
                <span className="text-[#8B7355]">Payment Method</span>
                <span className="font-semibold">{formatPaymentMethodLabel(detailPayment.method) || "UPI"}</span>
              </div>

              {detailPayment.id && (
                <div className="flex justify-between py-1.5 border-b border-[#F2EDE4]">
                  <span className="text-[#8B7355]">Reference ID</span>
                  <span className="font-mono text-[11px] text-[#2C1A0E]">{detailPayment.id}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDownloadPdf(detailPayment)}
                disabled={Boolean(downloadingPdfId)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B8641A] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#9F5414] disabled:opacity-50"
              >
                <Download size={14} /> {downloadingPdfId ? "Generating PDF..." : "Download Bill PDF"}
              </button>
              <button
                type="button"
                onClick={() => setDetailPayment(null)}
                className="rounded-xl border border-[#EDE8DF] bg-white px-5 py-2 text-xs font-bold text-[#6B5B3E] hover:bg-[#FAF5EF]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}
