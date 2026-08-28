// Admin customer domain facade: re-exports the public operations of the
// adminCustomers modules so existing importers keep their current imports.

export { getCustomerDetails } from "./adminCustomers/queries.service.js";
export {
  getAdminCustomers,
  getCustomerBillDetails,
  updateCustomerById,
  deleteCustomerById,
  upsertAdminCustomerSubscriptionById,
  approveCustomerSubscriptionById,
  assignPermanentDeliveryPartnerByCustomerId,
  pauseCustomerSubscriptionById,
  resumeCustomerSubscriptionById,
  cancelCustomerSubscriptionById,
} from "./adminCustomers/orders.service.js";
