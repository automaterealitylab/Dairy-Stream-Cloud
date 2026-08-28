// Customer deliveries domain facade. Re-exports the public operations from the
// deliveries/ modules so existing importers keep working unchanged.
//
// Modules:
//   normalizers.js         - parsing/formatting helpers (slots, notes, statuses)
//   queries.service.js     - database read helpers (maps, tables, products)
//   stock.service.js       - one-time order stock reserve/release
//   paymentLinks.service.js- payment-row linking for one-time orders
//   mapping.service.js     - delivery rows -> customer-facing cards/snapshots
//   orders.service.js      - public operations (snapshot, history, order flows)

export {
  getTodayDeliverySnapshot,
  getCustomerDeliveries,
  createOneTimeDeliveryOrder,
  cancelPendingOneTimeDeliveryOrder,
  reportCustomerDeliveryIssue,
  skipCustomerDelivery,
} from "./deliveries/orders.service.js";
