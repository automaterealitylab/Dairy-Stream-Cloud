import { CheckCircle, Clock } from "lucide-react";

export const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${
    status === "PAID"
      ? "bg-green-50 text-green-700 border-green-200"
      : status === "PENDING"
        ? "bg-orange-50 text-orange-700 border-orange-200"
        : "bg-red-50 text-red-700 border-red-200"
  }`}>
    {status === "PAID" ? <CheckCircle size={10} /> : <Clock size={10} />} {status}
  </span>
);
