import { supabase } from "../../config/supabase.js";

const normalizeDateOnly = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Sync and fetch notifications from the database
 */
export const getAdminNotifications = async ({ dairyId } = {}) => {
  if (!Number.isFinite(Number(dairyId))) {
    const error = new Error("Invalid dairy ID");
    error.statusCode = 400;
    throw error;
  }

  const targetDairyId = Number(dairyId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayDate = normalizeDateOnly(startOfDay);

  // 1. Fetch current notifications from the admin_notifications table
  let dbNotifications = [];
  let useDb = true;

  try {
    const { data, error } = await supabase
      .from("admin_notifications")
      .select("*")
      .eq("dairy_id", targetDairyId)
      .order("created_at", { ascending: false });

    if (error) {
      // If code is 42P01, the table doesn't exist yet
      if (error.code === "42P01") {
        console.warn("⚠️ admin_notifications table not found. Please run the SQL migrations.");
        useDb = false;
      } else {
        throw error;
      }
    } else {
      dbNotifications = data || [];
    }
  } catch (err) {
    console.error("Failed to query admin_notifications table:", err);
    useDb = false;
  }

  // 2. Query other tables safely to get live data to sync with db
  const fetchSafe = async (queryPromise, fallback = []) => {
    try {
      const { data, error } = await queryPromise;
      if (error) {
        console.warn("⚠️ Database query warning:", error.message || error);
        return fallback;
      }
      return data || fallback;
    } catch (err) {
      console.error("⚠️ Database query exception:", err.message || err);
      return fallback;
    }
  };

  const deliveriesToday = await fetchSafe(
    supabase
      .from("deliveries")
      .select("id, quantity_liters, status, delivery_date")
      .eq("dairy_id", targetDairyId)
      .eq("delivery_date", todayDate)
  );

  const paymentsList = await fetchSafe(
    supabase
      .from("payments")
      .select("id, amount, paid_at, created_at, status, customer_id")
      .eq("dairy_id", targetDairyId)
      .eq("status", "PAID")
      .order("created_at", { ascending: false })
      .limit(25)
  );

  const membershipsList = await fetchSafe(
    supabase
      .from("memberships")
      .select("id, created_at, customer_id")
      .eq("dairy_id", targetDairyId)
      .order("created_at", { ascending: false })
      .limit(25)
  );

  const ordersList = await fetchSafe(
    supabase
      .from("orders")
      .select("id, amount, created_at, payment_status, customer_id")
      .eq("dairy_id", targetDairyId)
      .order("created_at", { ascending: false })
      .limit(25)
  );

  const monthlyBillsList = await fetchSafe(
    supabase
      .from("monthly_bills")
      .select("id, customer_id, billing_month, bill_number, subtotal, adjustments, total_amount, paid_amount, due_amount, status, due_date, generated_at, created_at")
      .eq("dairy_id", targetDairyId)
      .order("created_at", { ascending: false })
      .limit(100)
  );

  // Fetch customer names in bulk to avoid missing relationships 500 error
  const customerIds = [
    ...new Set([
      ...paymentsList.map(p => p.customer_id),
      ...membershipsList.map(m => m.customer_id),
      ...ordersList.map(o => o.customer_id),
      ...monthlyBillsList.map(b => b.customer_id)
    ].filter(Boolean))
  ];

  const customerNameMap = new Map();
  if (customerIds.length > 0) {
    const { data: customersList, error: custError } = await supabase
      .from("customers")
      .select("id, name, customer_name")
      .in("id", customerIds);
    
    if (custError) {
      console.error("Failed to fetch customer names:", custError);
    } else if (customersList) {
      customersList.forEach(c => {
        customerNameMap.set(Number(c.id), c.customer_name || c.name || "Customer");
      });
    }
  }

  const pendingDeliveries = deliveriesToday.filter(
    (d) => String(d.status || "").toUpperCase() === "PENDING"
  );
  const pendingCount = pendingDeliveries.length;

  const dynamicNotifications = [];
  const toInsert = [];

  // Helper for delivery notifications inside the DB sync loop
  if (useDb) {
    // A. Pending Deliveries Sync
    const existingPending = dbNotifications.find(
      (n) => n.type === "DELIVERY_PENDING" && n.metadata?.deliveryDate === todayDate
    );

    if (pendingCount > 0) {
      const title = "Deliveries Pending";
      const message = `You have ${pendingCount} milk deliveries pending to be done today.`;
      
      if (!existingPending) {
        toInsert.push({
          dairy_id: targetDairyId,
          type: "DELIVERY_PENDING",
          title,
          message,
          priority: "medium",
          created_at: startOfDay.toISOString(),
          metadata: { deliveryDate: todayDate, count: pendingCount },
        });
      } else if (existingPending.metadata?.count !== pendingCount) {
        // Update count if different
        await supabase
          .from("admin_notifications")
          .update({
            message,
            metadata: { deliveryDate: todayDate, count: pendingCount },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingPending.id);
      }
    } else if (existingPending) {
      // Delete if no more pending deliveries
      await supabase.from("admin_notifications").delete().eq("id", existingPending.id);
    }

    // B. Completed Deliveries Sync
    const existingComplete = dbNotifications.find(
      (n) => n.type === "DELIVERIES_COMPLETE" && n.metadata?.deliveryDate === todayDate
    );

    if (deliveriesToday.length > 0 && pendingCount === 0) {
      if (!existingComplete) {
        toInsert.push({
          dairy_id: targetDairyId,
          type: "DELIVERIES_COMPLETE",
          title: "Deliveries Completed",
          message: `All ${deliveriesToday.length} deliveries for today have been completed.`,
          priority: "success",
          created_at: startOfDay.toISOString(),
          metadata: { deliveryDate: todayDate, totalCount: deliveriesToday.length },
        });
      }
    }
  } else {
    // If not using DB, put today's delivery state directly into dynamic list
    if (pendingCount > 0) {
      dynamicNotifications.push({
        id: `deliveries-pending-${todayDate}`,
        type: "DELIVERY_PENDING",
        title: "Deliveries Pending",
        message: `You have ${pendingCount} milk deliveries pending to be done today.`,
        timestamp: startOfDay.toISOString(),
        priority: "medium",
        is_read: false,
      });
    }
    if (deliveriesToday.length > 0 && pendingCount === 0) {
      dynamicNotifications.push({
        id: `deliveries-complete-${todayDate}`,
        type: "DELIVERIES_COMPLETE",
        title: "Deliveries Completed",
        message: `All ${deliveriesToday.length} deliveries for today have been completed.`,
        timestamp: startOfDay.toISOString(),
        priority: "success",
        is_read: false,
      });
    }
  }

  // C. Payments Received Sync
  paymentsList.forEach((pay) => {
    const custName = customerNameMap.get(Number(pay.customer_id)) || "Customer";
    const title = "Payment Received";
    const message = `Received payment of ₹${pay.amount} from ${custName}.`;
    const timestamp = pay.paid_at || pay.created_at;

    if (useDb) {
      const exists = dbNotifications.some(
        (n) => n.type === "PAYMENT_RECEIVED" && Number(n.metadata?.paymentId) === Number(pay.id)
      );
      if (!exists) {
        toInsert.push({
          dairy_id: targetDairyId,
          type: "PAYMENT_RECEIVED",
          title,
          message,
          priority: "success",
          created_at: timestamp,
          metadata: { paymentId: pay.id, customerId: pay.customer_id },
        });
      }
    } else {
      dynamicNotifications.push({
        id: `payment-${pay.id}`,
        type: "PAYMENT_RECEIVED",
        title,
        message,
        timestamp,
        priority: "success",
        is_read: false,
        data: { paymentId: pay.id, customerId: pay.customer_id },
      });
    }
  });

  // D. New Customer Sync
  membershipsList.forEach((member) => {
    const custName = customerNameMap.get(Number(member.customer_id)) || "Customer";
    const title = "New Customer Added";
    const message = `New customer ${custName} registered to your dairy.`;
    const timestamp = member.created_at;

    if (useDb) {
      const exists = dbNotifications.some(
        (n) => n.type === "NEW_CUSTOMER" && Number(n.metadata?.customerId) === Number(member.customer_id)
      );
      if (!exists) {
        toInsert.push({
          dairy_id: targetDairyId,
          type: "NEW_CUSTOMER",
          title,
          message,
          priority: "info",
          created_at: timestamp,
          metadata: { customerId: member.customer_id },
        });
      }
    } else {
      dynamicNotifications.push({
        id: `customer-added-${member.customer_id}`,
        type: "NEW_CUSTOMER",
        title,
        message,
        timestamp,
        priority: "info",
        is_read: false,
        data: { customerId: member.customer_id },
      });
    }
  });

  // E. One-Time Orders Sync
  ordersList.forEach((order) => {
    const custName = customerNameMap.get(Number(order.customer_id)) || "Customer";
    const title = "New One-Time Order";
    const message = `One-time order of ₹${order.amount} placed by ${custName}.`;
    const timestamp = order.created_at;

    if (useDb) {
      const exists = dbNotifications.some(
        (n) => n.type === "ONE_TIME_ORDER" && Number(n.metadata?.orderId) === Number(order.id)
      );
      if (!exists) {
        toInsert.push({
          dairy_id: targetDairyId,
          type: "ONE_TIME_ORDER",
          title,
          message,
          priority: "info",
          created_at: timestamp,
          metadata: { orderId: order.id, customerId: order.customer_id },
        });
      }
    } else {
      dynamicNotifications.push({
        id: `order-${order.id}`,
        type: "ONE_TIME_ORDER",
        title,
        message,
        timestamp,
        priority: "info",
        is_read: false,
        data: { orderId: order.id, customerId: order.customer_id },
      });
    }
  });

  // F. Monthly Bills Sync
  monthlyBillsList.forEach((bill) => {
    const custName = customerNameMap.get(Number(bill.customer_id)) || "Customer";
    const billGeneratedTimestamp = bill.generated_at || bill.created_at;

    // F1. Bill Generated Notification
    if (useDb) {
      const genExists = dbNotifications.some(
        (n) => n.type === "MONTHLY_BILL_GENERATED" && Number(n.metadata?.monthlyBillId) === Number(bill.id)
      );
      if (!genExists) {
        toInsert.push({
          dairy_id: targetDairyId,
          type: "MONTHLY_BILL_GENERATED",
          title: "Monthly Bill Generated",
          message: `Monthly bill of ₹${bill.total_amount} generated for ${custName} (Month: ${bill.billing_month}).`,
          priority: "info",
          created_at: billGeneratedTimestamp,
          metadata: { monthlyBillId: bill.id, customerId: bill.customer_id, billingMonth: bill.billing_month, amount: bill.total_amount },
        });
      }
    } else {
      dynamicNotifications.push({
        id: `bill-generated-${bill.id}`,
        type: "MONTHLY_BILL_GENERATED",
        title: "Monthly Bill Generated",
        message: `Monthly bill of ₹${bill.total_amount} generated for ${custName} (Month: ${bill.billing_month}).`,
        timestamp: billGeneratedTimestamp,
        priority: "info",
        is_read: false,
        data: { monthlyBillId: bill.id, customerId: bill.customer_id, billingMonth: bill.billing_month, amount: bill.total_amount },
      });
    }

    // F2. Bill Overdue Notification
    const isOverdue = String(bill.status || "").toUpperCase() === "OVERDUE" || 
                     (String(bill.status || "").toUpperCase() !== "PAID" && bill.due_date && new Date(bill.due_date) < new Date(todayDate));
    if (isOverdue) {
      const overdueTimestamp = bill.due_date ? new Date(bill.due_date + "T23:59:59Z").toISOString() : billGeneratedTimestamp;
      if (useDb) {
        const overdueExists = dbNotifications.some(
          (n) => n.type === "MONTHLY_BILL_OVERDUE" && Number(n.metadata?.monthlyBillId) === Number(bill.id)
        );
        if (!overdueExists) {
          toInsert.push({
            dairy_id: targetDairyId,
            type: "MONTHLY_BILL_OVERDUE",
            title: "Monthly Bill Overdue",
            message: `Monthly bill of ₹${bill.total_amount} for ${custName} is overdue (Due Date: ${bill.due_date || "N/A"}).`,
            priority: "high",
            created_at: overdueTimestamp,
            metadata: { monthlyBillId: bill.id, customerId: bill.customer_id, billingMonth: bill.billing_month, amount: bill.total_amount, dueDate: bill.due_date },
          });
        }
      } else {
        dynamicNotifications.push({
          id: `bill-overdue-${bill.id}`,
          type: "MONTHLY_BILL_OVERDUE",
          title: "Monthly Bill Overdue",
          message: `Monthly bill of ₹${bill.total_amount} for ${custName} is overdue (Due Date: ${bill.due_date || "N/A"}).`,
          timestamp: overdueTimestamp,
          priority: "high",
          is_read: false,
          data: { monthlyBillId: bill.id, customerId: bill.customer_id, billingMonth: bill.billing_month, amount: bill.total_amount, dueDate: bill.due_date },
        });
      }
    }
  });

  // 3. Batch insert new records into the DB if using DB
  if (useDb && toInsert.length > 0) {
    try {
      const { error: insertError } = await supabase
        .from("admin_notifications")
        .insert(toInsert);

      if (insertError) throw insertError;

      // Re-query notifications to get the fresh IDs
      const { data: refreshedData, error: refreshError } = await supabase
        .from("admin_notifications")
        .select("*")
        .eq("dairy_id", targetDairyId)
        .order("created_at", { ascending: false });

      if (!refreshError) {
        dbNotifications = refreshedData || [];
      }
    } catch (insertErr) {
      console.error("Failed to insert synced notifications:", insertErr);
    }
  }

  // Combine lists
  const finalNotificationsList = useDb
    ? dbNotifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        priority: n.priority,
        is_read: n.is_read,
        timestamp: n.created_at,
        data: n.metadata,
      }))
    : dynamicNotifications;

  // Sort by timestamp descending
  finalNotificationsList.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return finalNotificationsList;
};

/**
 * Mark a single notification as read
 */
export const markNotificationRead = async ({ notificationId, dairyId } = {}) => {
  const { data, error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("dairy_id", dairyId)
    .select("*");

  if (error) throw error;
  return data;
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsRead = async ({ dairyId } = {}) => {
  const { data, error } = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("dairy_id", dairyId)
    .select("*");

  if (error) throw error;
  return data;
};
