export const buildCustomerAddress = (source = {}) => {
  const parts = [
    source.address_line_1 || source.addressLine1 || "",
    source.address_line_2 || source.addressLine2 || "",
    source.building_name || source.buildingName || "",
    source.wing || "",
    source.room_no || source.roomNo || "",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  if (parts.length) return parts.join(", ");

  const directAddress = [
    source.address,
    source.fullAddress,
    source.areaSectorLocality,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  return directAddress ? directAddress.trim() : "";
};
