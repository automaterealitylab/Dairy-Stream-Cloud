// Map a raw delivery row into the agent-facing delivery card shape.

import { getSlotWindow } from "../../../constants/deliverySlots.js";
import {
  formatAddress,
  formatQuantity,
  normalizeCoordinate,
  normalizeDate,
  normalizeDeliverySlot,
  normalizeStatusForCard,
  toDeliverySlotLabel,
} from "./normalizers.js";
import {
  getDeliveryTypeFromNotes,
  parseDeliveryProof,
  parseFailedReason,
  parseNotesField,
  parseOrderPaymentMeta,
  parsePaymentCollection,
} from "./notes.service.js";

export const mapAssignedDelivery = (row, lookups) => {
  const customer = lookups.customersById.get(row.customer_id) || {};
  const dairy = lookups.dairiesById.get(row.dairy_id) || {};
  const latitude = normalizeCoordinate(customer.latitude);
  const longitude = normalizeCoordinate(customer.longitude);
  const dairyLatitude = normalizeCoordinate(dairy.latitude);
  const dairyLongitude = normalizeCoordinate(dairy.longitude);
  const parsedProof = parseDeliveryProof(row.notes);
  const deliveryType = getDeliveryTypeFromNotes(row.notes);
  const paymentMeta = parseOrderPaymentMeta(row.notes, row.quantity_liters);
  const paymentCollection = parsePaymentCollection(row.notes);
  const requiresPaymentCollection =
    deliveryType === "BUY ONCE" && paymentMeta.paymentMethod === "COD";
  const parsedSlot = normalizeDeliverySlot(row.delivery_slot || parseNotesField(row.notes, "slot") || "");
  const slotKey = ["MORNING", "EVENING"].includes(parsedSlot) ? parsedSlot : null;
  const slot = slotKey ? toDeliverySlotLabel(slotKey) : String(row.delivery_slot || parseNotesField(row.notes, "slot") || "-");
  const slotWindow = getSlotWindow(slotKey);

  return {
    id: String(row.id),
    rawId: row.id,
    customerId: String(row.customer_id || ""),
    customerName: customer.customer_name || `Customer #${row.customer_id ?? "-"}`,
    phoneNumber: customer.phone_number || "-",
    address: formatAddress(customer),
    addressLine1: customer.address_line_1 || "",
    addressLine2: customer.address_line_2 || "",
    buildingName: customer.building_name || "",
    wing: customer.wing || "",
    roomNo: customer.room_no || "",
    latitude,
    longitude,
    lat: latitude,
    lng: longitude,
    hasLocationPin: latitude !== null && longitude !== null,
    milk_type: row.milk_type || "",
    milkType: row.milk_type || "",
    product: row.milk_type || "",
    productName: row.milk_type || "",
    quantity_liters: Number(row.quantity_liters ?? 0),
    quantity: formatQuantity(row.quantity_liters),
    status: normalizeStatusForCard(row.status),
    dairyFarmId: row.dairy_id ?? null,
    dairyFarmName: dairy.dairy_name || "Dairy",
    dairyLatitude,
    dairyLongitude,
    dairyLat: dairyLatitude,
    dairyLng: dairyLongitude,
    farmPhoneNumber: "-",
    deliveryType,
    slot,
    slotKey,
    slotWindow,
    orderPaymentMethod: paymentMeta.paymentMethod || null,
    requiresPaymentCollection,
    amountDue: paymentMeta.amountDue,
    upiId: dairy.upi_id || null,
    paymentCollectionMethod: paymentCollection.collectionMethod,
    paymentCollectionStatus: paymentCollection.paymentStatus,
    failedReason: parseFailedReason(row.notes),
    deliveryProofType: parsedProof.proofType,
    deliveryProofValue: parsedProof.proofValue,
    failedImage: null,
    date: normalizeDate(row.delivery_date || row.created_at),
    completedAt: row.updated_at || row.created_at || null,
  };
};
