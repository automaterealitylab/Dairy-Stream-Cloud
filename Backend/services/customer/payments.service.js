// Facade for the customer payments domain. Kept for backward-compatible
// imports; the implementation lives in the payments/ folder modules.
//
//   payments/
//     constants.js          column/marker/rate constants
//     normalizers.js        row classification, mapping, formatting
//     queries.service.js    database read helpers
//     wallet.service.js     wallet credit/debit + ledger entries
//     razorpay.service.js   Razorpay client, transfers, verification
//     update.service.js     payment row updates + audit writes
//     orders.service.js     public orchestration (orders, verification, UPI)

export {
  createCustomerPaymentOrder,
  verifyCustomerPayment,
  createCustomerWalletTopupOrder,
  verifyCustomerWalletTopup,
  addAmountToCustomerWallet,
  createCustomerUpiPaymentIntent,
  submitCustomerUpiPaymentVerification,
  getCustomerPaymentsData,
  payCustomerBillWithWallet,
} from "./payments/orders.service.js";
