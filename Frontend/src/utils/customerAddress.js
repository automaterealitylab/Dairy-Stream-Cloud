export const buildCustomerAddress = (source = {}) => {
  const line1 = String(source.address_line_1 || source.addressLine1 || "").trim();
  const line2 = String(source.address_line_2 || source.addressLine2 || "").trim();
  const building = String(source.building_name || source.buildingName || "").trim();
  const wing = String(source.wing || "").trim();
  const room = String(source.room_no || source.roomNo || "").trim();

  const combinedLines = `${line1} ${line2}`.toLowerCase();

  const addressParts = [];

  if (room && !combinedLines.includes(room.toLowerCase())) {
    const formattedRoom = /^flat|^room|^apt|^unit/i.test(room) ? room : `Flat ${room}`;
    addressParts.push(formattedRoom);
  }

  if (wing && !combinedLines.includes(wing.toLowerCase())) {
    const formattedWing = /^wing/i.test(wing) ? wing : `Wing ${wing}`;
    addressParts.push(formattedWing);
  }

  if (building && !combinedLines.includes(building.toLowerCase())) {
    addressParts.push(building);
  }

  if (line1) addressParts.push(line1);
  if (line2) addressParts.push(line2);

  // Filter unique parts case-insensitively while preserving original order
  const uniqueParts = [];
  for (const part of addressParts) {
    const trimmed = part.trim();
    if (trimmed && !uniqueParts.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) {
      uniqueParts.push(trimmed);
    }
  }

  if (uniqueParts.length > 0) {
    return uniqueParts.join(", ");
  }

  const directAddress = [
    source.address,
    source.fullAddress,
    source.areaSectorLocality,
  ].find((value) => typeof value === "string" && value.trim().length > 0);

  return directAddress ? directAddress.trim() : "";
};
