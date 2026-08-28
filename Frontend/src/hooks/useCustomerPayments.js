import { useEffect, useState } from "react";

import {
  fetchCustomerPayments,
  getCachedCustomerPayments,
} from "../api/customer/customer.api.js";
import {
  EMPTY_SUMMARY,
  getAuthToken,
  toPaymentsViewState,
} from "../utils/customerPayments.js";

export const useCustomerPayments = () => {
  const cachedPayments = getCachedCustomerPayments();
  const initialPaymentsState = toPaymentsViewState(cachedPayments);
  const [summary, setSummary] = useState(initialPaymentsState.summary);
  const [history, setHistory] = useState(initialPaymentsState.history);
  const [loading, setLoading] = useState(() => !cachedPayments);
  const [error, setError] = useState(null);

  const applyPaymentsState = (data) => {
    const nextState = toPaymentsViewState(data);
    setSummary(nextState.summary);
    setHistory(nextState.history);
  };

  const loadPayments = async ({ force = false, showSpinner = force || !getCachedCustomerPayments() } = {}) => {
    if (showSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      if (!getAuthToken()) throw new Error("Session expired. Please log in again.");

      const data = await fetchCustomerPayments({ force });
      applyPaymentsState(data);
    } catch (err) {
      setError(err?.message || "Failed to load payments.");
      const hasVisiblePayments =
        history.length > 0 ||
        Number(summary.billingSummaryAmount || 0) > 0 ||
        Number(summary.monthlyDue || 0) > 0 ||
        Number(summary.walletBalance || 0) > 0;

      if (!hasVisiblePayments) {
        setSummary(EMPTY_SUMMARY);
        setHistory([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadPayments({ force: true, showSpinner: false });
    }, 30000);

    const handleFocus = () => {
      loadPayments({ force: true, showSpinner: false });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return { summary, history, loading, error, setError, loadPayments };
};
