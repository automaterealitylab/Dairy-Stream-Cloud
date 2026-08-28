// Payment domain constants: table column fallbacks and description markers.

export const PAYMENT_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];
export const MEMBERSHIP_CUSTOMER_COLUMNS = ["customer_id", "user_id", "customerId", "customerid"];

export const SUBSCRIPTION_DELIVERY_PAYMENT_MARKER = "[SUBSCRIPTION_DELIVERY_PAYMENT]";
export const ONE_TIME_PAYMENT_MARKER = "[ONE_TIME_PAYMENT]";
export const WALLET_TOPUP_MARKER = "[WALLET_TOPUP";
export const ONE_TIME_ORDER_CANCEL_MARKER = "[ONE_TIME_ORDER_CANCEL]";

/** Overdue penalty applied to overdue bill amounts (1%). */
export const OVERDUE_PENALTY_RATE = 0.01;
