import {
  PlusCircle,
  PauseCircle,
  Truck,
  CreditCard,
} from "lucide-react";

export const headingFont = { fontFamily: "'Lora', serif" };

export const ACTIONS = [
  {
    key: "add",
    label: "Add Extra",
    Icon: PlusCircle,
    bg: "bg-[#FFF4E2]",
    text: "text-[#B8641A]",
    border: "border-[#EFD7B3]",
    route: null,
  },
  {
    key: "pause",
    label: "Pause",
    Icon: PauseCircle,
    bg: "bg-[#FFF1E4]",
    text: "text-[#C86A2B]",
    border: "border-[#F0D1B2]",
    route: null,
  },
  {
    key: "deliveries",
    label: "Deliveries",
    Icon: Truck,
    bg: "bg-[#EEF5E7]",
    text: "text-[#4A7C2F]",
    border: "border-[#DDE8D1]",
    route: "/customer/dashboard/deliveries",
  },
  {
    key: "pay",
    label: "Pay Bill",
    Icon: CreditCard,
    bg: "bg-[#FDECEA]",
    text: "text-[#C0392B]",
    border: "border-[#F2D0C8]",
    route: "/customer/dashboard/payments",
  },
];
