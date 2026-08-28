// Marketplace domain facade. Re-exports the public operations from the
// sibling modules so existing importers keep working unchanged.
//
// Modules:
//   normalizers.js          - pure normalization/validation helpers
//   customers.service.js    - marketplace customer upsert
//   pricing.service.js      - order pricing (tax + delivery fee)
//   queries.service.js      - dairy/order/transfer read helpers
//   status.service.js       - order/payment status transitions
//   registration.service.js - dairy onboarding + listing
//   orders.service.js       - checkout + payment verification
//   webhook.service.js      - Razorpay webhook ingestion/processing
//   dashboard.service.js    - admin and dairy dashboards

export { registerMarketplaceDairy } from "./registration.service.js";
export { listMarketplaceDairies, listMarketplaceProducts } from "./registration.service.js";
export { createMarketplaceOrder, verifyMarketplacePayment } from "./orders.service.js";
export {
  processMarketplaceWebhookPayload,
  processStoredMarketplaceWebhook,
  handleMarketplaceWebhook,
} from "./webhook.service.js";
export { getMarketplaceAdminDashboard, getMarketplaceDairyDashboard } from "./dashboard.service.js";
