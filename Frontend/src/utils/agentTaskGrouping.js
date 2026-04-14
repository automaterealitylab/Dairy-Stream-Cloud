const normalizeText = (value) => String(value || "").trim();

const extractAddressPart = (address = "", index = 0) => {
  const parts = String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[index] || "";
};

export const getBuildingName = (delivery = {}) => {
  return (
    normalizeText(delivery.buildingName) ||
    normalizeText(delivery.building_name) ||
    extractAddressPart(delivery.address, 1) ||
    "Unknown Building"
  );
};

export const getCustomerName = (delivery = {}) =>
  normalizeText(delivery.customerName) ||
  normalizeText(delivery.customer_name) ||
  "Customer";

export const getFlatLabel = (delivery = {}) => {
  return (
    normalizeText(delivery.roomNo) ||
    normalizeText(delivery.room_no) ||
    extractAddressPart(delivery.address, 0) ||
    "Flat -"
  );
};

export const getProductLabel = (delivery = {}) => {
  return (
    normalizeText(delivery.product) ||
    normalizeText(delivery.productName) ||
    normalizeText(delivery.milkType) ||
    normalizeText(delivery.itemName) ||
    "Milk"
  );
};

export const getQuantityValue = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

export const formatQuantity = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return "0";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1).replace(/\.0$/, "");
};

const getRawFloor = (delivery = {}) =>
  normalizeText(delivery.wingOrFloor) || normalizeText(delivery.wing_or_floor);

const deriveFloorFromFlat = (flatLabel) => {
  const digits = String(flatLabel || "").match(/\d+/)?.[0] || "";
  if (digits.length >= 3) {
    return String(Number(digits.slice(0, -2)));
  }
  return "";
};

export const getFloorInfo = (delivery = {}) => {
  const rawFloor = getRawFloor(delivery);
  const flatLabel = getFlatLabel(delivery);
  const derivedFloor = deriveFloorFromFlat(flatLabel);
  const resolved = rawFloor || derivedFloor;
  const numeric = Number(String(resolved).match(/\d+/)?.[0]);

  return {
    raw: resolved || "Other",
    numeric: Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY,
    label: resolved ? `Floor ${resolved}` : "Other",
  };
};

export const compareFlatLabels = (left, right) => {
  const leftLabel = String(left || "").trim();
  const rightLabel = String(right || "").trim();
  const leftNumber = Number(leftLabel.match(/\d+/)?.[0]);
  const rightNumber = Number(rightLabel.match(/\d+/)?.[0]);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  return leftLabel.localeCompare(rightLabel, undefined, { numeric: true, sensitivity: "base" });
};

export const isMilkProduct = (delivery = {}) => {
  const productType = normalizeText(delivery.type || delivery.productType).toUpperCase();
  const productLabel = getProductLabel(delivery).toUpperCase();
  return productType === "MILK" || productLabel.includes("MILK");
};

export const buildBuildingTaskGroups = (deliveries = []) => {
  const groups = new Map();

  deliveries.forEach((delivery) => {
    const buildingName = getBuildingName(delivery);

    if (!groups.has(buildingName)) {
      groups.set(buildingName, {
        buildingName,
        deliveries: [],
        milkTotal: 0,
        milkTypes: new Map(),
        otherProducts: new Map(),
      });
    }

    const group = groups.get(buildingName);
    const quantity = getQuantityValue(delivery.quantity);
    const productLabel = getProductLabel(delivery);

    group.deliveries.push(delivery);

    if (isMilkProduct(delivery)) {
      group.milkTotal += quantity;
      group.milkTypes.set(productLabel, (group.milkTypes.get(productLabel) || 0) + quantity);
    } else {
      group.otherProducts.set(productLabel, (group.otherProducts.get(productLabel) || 0) + (quantity || 1));
    }
  });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      milkTypes: [...group.milkTypes.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([name, quantity]) => ({
          name,
          quantity,
          label: `${name} ${formatQuantity(quantity)} L`,
        })),
      otherProducts: [...group.otherProducts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([name, quantity]) => ({
          name,
          quantity,
          label: `${name} x ${formatQuantity(quantity)}`,
        })),
    }))
    .sort((left, right) => left.buildingName.localeCompare(right.buildingName));
};

export const buildFloorGroups = (deliveries = []) => {
  const floors = new Map();

  deliveries.forEach((delivery) => {
    const floor = getFloorInfo(delivery);

    if (!floors.has(floor.label)) {
      floors.set(floor.label, {
        floorLabel: floor.label,
        floorNumber: floor.numeric,
        customers: [],
      });
    }

    floors.get(floor.label).customers.push({
      id: delivery.id,
      customerName: getCustomerName(delivery),
      flatLabel: getFlatLabel(delivery),
      delivery,
    });
  });

  return [...floors.values()]
    .map((floor) => ({
      ...floor,
      customers: floor.customers.sort(
        (left, right) =>
          compareFlatLabels(left.flatLabel, right.flatLabel) ||
          left.customerName.localeCompare(right.customerName, undefined, {
            sensitivity: "base",
          })
      ),
    }))
    .sort(
      (left, right) =>
        left.floorNumber - right.floorNumber ||
        left.floorLabel.localeCompare(right.floorLabel, undefined, { sensitivity: "base" })
    );
};
