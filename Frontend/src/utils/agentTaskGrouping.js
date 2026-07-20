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
    normalizeText(delivery.milk_type) ||
    normalizeText(delivery.itemName)
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
  if (productType) return productType === "MILK";
  return productLabel.includes("MILK");
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
        paymentDueCount: 0,
        paymentDueAmount: 0,
      });
    }

    const group = groups.get(buildingName);
    const quantity = getQuantityValue(delivery.quantity ?? delivery.quantity_liters);
    const productLabel = getProductLabel(delivery);

    group.deliveries.push(delivery);

    if (isMilkProduct(delivery)) {
      group.milkTotal += quantity;
      group.milkTypes.set(productLabel, (group.milkTypes.get(productLabel) || 0) + quantity);
    } else {
      group.otherProducts.set(productLabel, (group.otherProducts.get(productLabel) || 0) + (quantity || 1));
    }

    const status = String(delivery?.status || "").toUpperCase();
    const needsCollection =
      Boolean(delivery?.requiresPaymentCollection) &&
      (status === "PENDING" || status === "OUT_FOR_DELIVERY");
    if (needsCollection) {
      const due = Number(delivery?.amountDue || 0);
      group.paymentDueCount += 1;
      group.paymentDueAmount += Number.isFinite(due) && due > 0 ? due : 0;
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

export const parsePacketInfo = (delivery = {}) => {
  const isMilk = isMilkProduct(delivery);
  const rawProduct = getProductLabel(delivery);
  const quantityValue = getQuantityValue(delivery?.quantity ?? delivery?.quantity_liters);

  // Check if product name explicitly mentions size, e.g. "Buffalo Milk (500ml)" or "Paneer 250g"
  let productName = rawProduct;
  let sizeLabel = "";

  const sizeInNameMatch = rawProduct.match(/^(.*?)\s*[(\\[]?\s*(\d+(?:\.\d+)?\s*(?:ml|l|liter|liters|kg|g|gm|gms|pack|packet|bottle))\s*[)\\]]?$/i);
  if (sizeInNameMatch) {
    productName = sizeInNameMatch[1].trim();
    sizeLabel = sizeInNameMatch[2].trim();
  }

  // Normalize product name for grouping (e.g. "Buffalo Milk")
  if (!productName) productName = isMilk ? "Milk" : "Product";

  if (isMilk) {
    const liters = quantityValue > 0 ? quantityValue : 0;

    // Check if explicit packet count and packet size are given in delivery
    const explicitPackets = Number(delivery?.packets || delivery?.packetCount || delivery?.packet_count);
    const explicitSize = String(delivery?.packetSize || delivery?.packet_size || sizeLabel || "").trim();

    if (Number.isFinite(explicitPackets) && explicitPackets > 0 && explicitSize) {
      return [{
        productName,
        sizeLabel: explicitSize,
        packets: explicitPackets,
        liters,
        isMilk: true,
      }];
    }

    // If explicit size in liters (e.g. 0.5 L or 1 L)
    if (explicitSize) {
      const lowerSize = explicitSize.toLowerCase();
      let packetSizeLiters = 1;
      if (lowerSize.includes("500ml") || lowerSize.includes("500 ml") || lowerSize.includes("0.5l") || lowerSize.includes("0.5 l")) {
        packetSizeLiters = 0.5;
      } else if (lowerSize.includes("250ml") || lowerSize.includes("250 ml") || lowerSize.includes("0.25l")) {
        packetSizeLiters = 0.25;
      } else if (lowerSize.includes("1l") || lowerSize.includes("1 l") || lowerSize.includes("1 liter")) {
        packetSizeLiters = 1;
      } else if (lowerSize.includes("2l") || lowerSize.includes("2 l")) {
        packetSizeLiters = 2;
      }

      const packets = Math.max(1, Math.round(liters / packetSizeLiters));
      const formattedSize = packetSizeLiters >= 1 ? `${formatQuantity(packetSizeLiters)} L` : `${Math.round(packetSizeLiters * 1000)} ml`;

      return [{
        productName,
        sizeLabel: formattedSize,
        packets,
        liters,
        isMilk: true,
      }];
    }

    // Standard decomposition of liters into 1 L and 500 ml (or 250 ml) packets
    const items = [];
    if (liters <= 0) {
      return [];
    }

    const fullLiters = Math.floor(liters);
    const remainder = Number((liters - fullLiters).toFixed(3));

    if (fullLiters > 0) {
      items.push({
        productName,
        sizeLabel: "1 L",
        packets: fullLiters,
        liters: fullLiters,
        isMilk: true,
      });
    }

    if (remainder >= 0.75) {
      items.push({
        productName,
        sizeLabel: "500 ml",
        packets: 1,
        liters: 0.5,
        isMilk: true,
      });
      items.push({
        productName,
        sizeLabel: "250 ml",
        packets: 1,
        liters: 0.25,
        isMilk: true,
      });
    } else if (remainder >= 0.45 && remainder <= 0.6) {
      items.push({
        productName,
        sizeLabel: "500 ml",
        packets: 1,
        liters: 0.5,
        isMilk: true,
      });
    } else if (remainder > 0 && remainder <= 0.35) {
      items.push({
        productName,
        sizeLabel: "250 ml",
        packets: 1,
        liters: 0.25,
        isMilk: true,
      });
    } else if (remainder > 0) {
      items.push({
        productName,
        sizeLabel: "500 ml",
        packets: 1,
        liters: remainder,
        isMilk: true,
      });
    }

    return items;
  } else {
    // Extra products (Paneer, Curd, Ghee, etc.)
    const units = quantityValue > 0 ? Math.round(quantityValue) : 1;
    const size = sizeLabel || String(delivery?.unit || delivery?.weight || delivery?.size || "").trim();

    return [{
      productName,
      sizeLabel: size,
      packets: units,
      liters: 0,
      isMilk: false,
    }];
  }
};

export const calculateDetailedDeliverySummary = (deliveries = []) => {
  const milkGroups = new Map();
  const extraGroups = new Map();

  let totalMilkLiters = 0;
  let totalMilkPackets = 0;
  let totalExtraPackets = 0;

  deliveries.forEach((delivery) => {
    const parsedItems = parsePacketInfo(delivery);

    parsedItems.forEach((item) => {
      if (item.isMilk) {
        totalMilkLiters += item.liters;
        totalMilkPackets += item.packets;

        if (!milkGroups.has(item.productName)) {
          milkGroups.set(item.productName, {
            name: item.productName,
            totalQuantityLiters: 0,
            totalPackets: 0,
            sizes: new Map(),
          });
        }

        const group = milkGroups.get(item.productName);
        group.totalQuantityLiters += item.liters;
        group.totalPackets += item.packets;
        group.sizes.set(item.sizeLabel, (group.sizes.get(item.sizeLabel) || 0) + item.packets);
      } else {
        totalExtraPackets += item.packets;

        const groupKey = `${item.productName}::${item.sizeLabel}`;
        if (!extraGroups.has(groupKey)) {
          extraGroups.set(groupKey, {
            name: item.productName,
            sizeLabel: item.sizeLabel,
            packets: 0,
          });
        }

        const group = extraGroups.get(groupKey);
        group.packets += item.packets;
      }
    });
  });

  // Sort size labels cleanly (1 L first, then 500 ml, 250 ml)
  const sortSizeLabels = (a, b) => {
    if (a.includes("L") && b.includes("ml")) return -1;
    if (a.includes("ml") && b.includes("L")) return 1;
    const numA = parseFloat(a) || 0;
    const numB = parseFloat(b) || 0;
    return numB - numA;
  };

  const milkTypes = [...milkGroups.values()]
    .sort((left, right) => right.totalQuantityLiters - left.totalQuantityLiters || left.name.localeCompare(right.name))
    .map((group) => {
      const breakdown = [...group.sizes.entries()]
        .sort(([sizeA], [sizeB]) => sortSizeLabels(sizeA, sizeB))
        .map(([sizeLabel, packets]) => ({
          sizeLabel,
          packets,
          label: `${sizeLabel} × ${packets} Packet${packets === 1 ? "" : "s"}`,
        }));

      return {
        name: group.name,
        totalQuantityLiters: group.totalQuantityLiters,
        totalPackets: group.totalPackets,
        formattedTotal: `Total: ${formatQuantity(group.totalQuantityLiters)} L (${group.totalPackets} Packet${group.totalPackets === 1 ? "" : "s"})`,
        breakdown,
      };
    });

  const extraProducts = [...extraGroups.values()]
    .sort((left, right) => right.packets - left.packets || left.name.localeCompare(right.name))
    .map((item) => ({
      name: item.name,
      sizeLabel: item.sizeLabel,
      packets: item.packets,
      label: item.sizeLabel
        ? `${item.name} - ${item.sizeLabel} × ${item.packets}`
        : `${item.name} × ${item.packets}`,
    }));

  return {
    deliveryCount: deliveries.length,
    totalMilkLiters,
    totalMilkPackets,
    totalExtraPackets,
    totalItemsToCarry: totalMilkPackets + totalExtraPackets,
    milkTypes,
    extraProducts,
  };
};

