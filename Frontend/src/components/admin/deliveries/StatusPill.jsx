import { statusStyles } from "../../../constants/adminDeliveries.js";

export const StatusPill = ({ status }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyles[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
    {status}
  </span>
);
