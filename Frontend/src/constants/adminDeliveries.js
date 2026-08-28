// Static config maps for the Admin Deliveries page.

export const statusStyles = {
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  FAILED: "bg-red-100 text-red-700 border-red-200",
};

export const RESOLVE_ACTION_OPTIONS = [
  "Replacement milk sent",
  "Refund initiated",
  "Delivery partner warned",
  "Quality issue escalated to dairy team",
  "Customer contacted and issue clarified",
];

export const DELIVERY_SECTIONS = [
  { key: "ALL", label: "All Deliveries" },
  { key: "PENDING", label: "Delivery Pending" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "APPROVAL_PENDING", label: "Approval Pending" },
];
