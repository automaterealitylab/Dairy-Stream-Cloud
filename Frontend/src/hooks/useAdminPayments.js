import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  fetchAdminPayments,
  fetchAdminPaymentVerifications,
} from "../api/admin.api.js";
import { mapPlanName } from "../utils/adminPayments.js";
import { readStoredAutopay } from "../utils/autopayStorage.js";

export const useAdminPayments = () => {
  const [loading, setLoading] = useState(true);

  // Data States
  const [farmPlan, setFarmPlan] = useState(null);
  const [revenue, setRevenue] = useState(0);
  const [pendingDuesSummary, setPendingDuesSummary] = useState({ amount: 0, customerCount: 0 });
  const [payments, setPayments] = useState([]);
  const [verifications, setVerifications] = useState([]);

  // Filter state
  const [filter, setFilter] = useState("ALL");

  const loadPayments = async () => {
    try {
      setLoading(true);
      const [data, verificationRows] = await Promise.all([
        fetchAdminPayments({ page: 1, status: filter }),
        fetchAdminPaymentVerifications({ status: "PENDING", limit: 25 }),
      ]);

      const farm = data?.farm || null;
      const storedAutopay = readStoredAutopay(farm?.id || null);
      setFarmPlan({
        id: farm?.id || null,
        plan: mapPlanName(farm?.selected_plan),
        status: farm?.status || "ACTIVE",
        nextBilling: farm?.updated_at || null,
        upiId: farm?.upi_id || "",
        bankName: farm?.bank_name || "",
        bankBranch: farm?.bank_branch || "",
        bankAccountHolderName: farm?.bank_account_holder_name || "",
        bankAccountNumber: farm?.bank_account_number || "",
        bankIfscCode: farm?.bank_ifsc_code || "",
        autopayEnabled: Boolean(storedAutopay?.enabled),
        autopayMethod: storedAutopay?.method || "",
        autopayConfiguredAt: storedAutopay?.configuredAt || null,
      });

      setRevenue(Number(data?.totalRevenue || 0));
      setPendingDuesSummary({
        amount: Number(data?.pendingDues?.amount || 0),
        customerCount: Number(data?.pendingDues?.customerCount || 0),
      });
      setPayments(Array.isArray(data?.payments) ? data.payments : []);
      setVerifications(Array.isArray(verificationRows) ? verificationRows : []);
    } catch (err) {
      toast.error(err?.response?.data?.error || "Failed to load payments");
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [filter]);

  return {
    loading,
    farmPlan,
    setFarmPlan,
    revenue,
    pendingDuesSummary,
    payments,
    verifications,
    filter,
    setFilter,
    loadPayments,
  };
};
