export const buildCustomerAddress = (source = {}) => {
  const directAddress = [
    source.address,
    source.fullAddress,
    source.areaSectorLocality,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  if (directAddress) return directAddress.trim();

  const parts = [
    source.building_name || source.buildingName || "",
    source.wing || "",
    source.room_no || source.roomNo || "",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.join(", ");
};
