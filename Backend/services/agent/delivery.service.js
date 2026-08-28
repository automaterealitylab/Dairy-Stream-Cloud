// Agent delivery domain facade. Re-exports the public operations from the
// delivery/ modules so existing importers keep working unchanged.
//
// Modules:
//   normalizers.js          - pure normalization/formatting helpers
//   notes.service.js        - delivery notes read/write (proof, failure, payment)
//   razorpay.service.js     - Razorpay client + per-dairy linked account
//   queries.service.js      - database read helpers + settings cache
//   mapping.service.js      - delivery rows -> agent-facing delivery cards
//   orders.service.js       - public operations (deliveries, collection, status)

export {
  getAgentAssignedDeliveries,
  createAgentOnlineCollectionQr,
  createAgentOnlineCollectionOrder,
  verifyAgentOnlineCollectionPayment,
  getAgentDashboard,
  getAgentDeliveryHistory,
  getAgentProfile,
  updateAgentAvailability,
  updateAgentDeliveryStatus,
} from "./delivery/orders.service.js";
