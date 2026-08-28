// Admin customer scoping validation: ensure a customer belongs to a dairy
// before mutating customer rows.

import { getCustomerDetails } from "./queries.service.js";

export const assertCustomerBelongsToDairy = async (customerId, dairyId) => {
  return await getCustomerDetails(customerId, { dairyId });
};
