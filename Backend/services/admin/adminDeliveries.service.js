// Facade for the admin deliveries domain. Kept for backward-compatible
// imports; the implementation lives in the adminDeliveries/ folder modules.
//
//   adminDeliveries/
//     normalizers.js           pure parse/normalize/status helpers
//     subscriptions.service.js subscription selection helpers
//     queries.service.js       customer/agent/dairy map + availability reads
//     assignment.service.js    agent candidate ranking + auto-assign
//     mapping.service.js       delivery row → delivery card mapping
//     notifications.service.js scheduled-delivery email alerts
//     orders.service.js        public operations (list, schedule, approve, assign)

export {
  getAdminDeliveries,
  getDeliverySchedulingOptions,
  scheduleDeliveryForSubscribedCustomer,
  scheduleBulkDeliveriesForDate,
  approvePendingDeliveryOrder,
  approveAllPendingDeliveryOrders,
  assignDeliveryPartnerToOrder,
  resolveDeliveryIssue,
  addAdminCustomerExtraDelivery,
} from "./adminDeliveries/orders.service.js";
