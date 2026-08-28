import { useEffect, useState } from 'react';
import {
  fetchCustomerSubscription,
  getCachedCustomerSubscription,
  fetchCustomerPayments,
  getCachedCustomerPayments,
} from '../api/customer/customer.api.js';
import { toUiSubscription, EMPTY_FORM } from '../utils/customerSubscription.js';

export const useCustomerSubscription = () => {
  const cachedSubscriptionData = getCachedCustomerSubscription();
  const cachedPaymentsData = getCachedCustomerPayments();
  const initialSubscription = toUiSubscription(cachedSubscriptionData?.subscription);

  const [subscription, setSubscription] = useState(initialSubscription);
  const [formData, setFormData] = useState(initialSubscription || EMPTY_FORM);

  const [loading, setLoading] = useState(() => !cachedSubscriptionData);
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

  return {
    subscription,
    setSubscription,
    formData,
    setFormData,
    loading,
    paymentsSummary,
    refreshPaymentsSummary,
  };
};
