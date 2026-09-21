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

export const getWingName = (delivery = {}) => {
  return (
    normalizeText(delivery.wing) ||
    normalizeText(delivery.wingName) ||
    normalizeText(delivery.wing_name) ||
    ""
  );
};

export const getUnitLabel = (delivery = {}) => {
  const raw =
    normalizeText(delivery.roomNo) ||
    normalizeText(delivery.room_no) ||
    extractAddressPart(delivery.address, 0);
  if (!raw) return "Unit -";
  if (/^(flat|room|shop|office|unit|block|suite|cabin)\b/i.test(raw)) {
    return raw;
  }
  return `Flat ${raw}`;
};

export const formatFloorName = (rawFloor, numeric) => {
  const clean = normalizeText(rawFloor);
  if (!clean) {
    return Number.isFinite(numeric) ? `Floor ${numeric}` : "Other";
  }
  if (/(floor|level|ground|mezzanine|basement|terrace|first|second|third)\b/i.test(clean)) {
    return clean;
  }
  if (/^\d+$/.test(clean)) {
    return `Floor ${clean}`;
  }
  return clean;
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

  let numeric = Number(String(resolved).match(/\d+/)?.[0]);
  if (!Number.isFinite(numeric)) {
    const lower = String(resolved || "").toLowerCase();
    if (lower.includes("ground") || lower === "g" || lower === "gf") {
      numeric = 0;
    } else if (lower.includes("basement") || lower === "b" || lower === "b1") {
      numeric = -1;
    } else if (lower.includes("mezzanine")) {
      numeric = 0.5;
    } else {
      numeric = Number.POSITIVE_INFINITY;
    }
  }

  return {
    raw: resolved || "Other",
    numeric: Number.isFinite(numeric) ? numeric : Number.POSITIVE_INFINITY,
    label: formatFloorName(resolved, numeric),
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

export const isDeliveryActive = (delivery = {}) => {
  const status = String(delivery?.status || "").toUpperCase();
  return status === "PENDING" || status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT";
};

export const isDeliveryTerminal = (delivery = {}) => {
  const status = String(delivery?.status || "").toUpperCase();
  return status === "COMPLETED" || status === "FAILED";
};

export const getBuildingCoordinates = (deliveries = []) => {
  for (const delivery of deliveries) {
    const lat = Number(
      delivery?.lat ??
      delivery?.latitude ??
      delivery?.customerLat ??
      delivery?.customerLatitude ??
      delivery?.location?.lat ??
      delivery?.location?.latitude
    );
    const lng = Number(
      delivery?.lng ??
      delivery?.longitude ??
      delivery?.customerLng ??
      delivery?.customerLongitude ??
      delivery?.location?.lng ??
      delivery?.location?.longitude
    );
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }
  }
  return null;
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
    .map((group) => {
      const activeDeliveries = group.deliveries.filter(isDeliveryActive);
      const completedDeliveries = group.deliveries.filter(isDeliveryTerminal);
      const isCompleted = group.deliveries.length > 0 && activeDeliveries.length === 0;
      const coordinates = getBuildingCoordinates(group.deliveries);

      return {
        ...group,
        coordinates,
        hasCoordinates: Array.isArray(coordinates),
        activeDeliveries,
        completedDeliveries,
        isCompleted,
        pendingCount: activeDeliveries.length,
        completedCount: completedDeliveries.length,
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
      };
    })
    .sort((left, right) => left.buildingName.localeCompare(right.buildingName));
};

export const separateBuildingTaskGroups = (groups = []) => {
  const active = [];
  const completed = [];

  groups.forEach((group) => {
    if (group.isCompleted) {
      completed.push(group);
    } else {
      active.push(group);
    }
  });

  return { active, completed };
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

export const getCustomerProductSummary = (delivery = {}) => {
  const primaryLabel = getProductLabel(delivery);
  const primaryQuantity = getQuantityValue(delivery?.quantity ?? delivery?.quantity_liters);
  const primaryIsMilk = isMilkProduct(delivery);
  const baseQuantity = primaryIsMilk
    ? `${formatQuantity(primaryQuantity)} L`
    : `x ${formatQuantity(primaryQuantity || 1)}`;

  const segments = [`Milk type: ${primaryLabel || "-"}`, `Quantity: ${baseQuantity}`];

  const extras = Array.isArray(delivery?.extraProducts)
    ? delivery.extraProducts
    : Array.isArray(delivery?.extras)
    ? delivery.extras
    : Array.isArray(delivery?.addOns)
    ? delivery.addOns
    : Array.isArray(delivery?.orderItems)
    ? delivery.orderItems
    : [];

  extras.forEach((extra) => {
    const label = String(
      extra?.name || extra?.product || extra?.productName || extra?.itemName || extra?.label || ""
    ).trim();
    if (!label || label.toLowerCase() === String(primaryLabel || "").toLowerCase()) return;

    const qty = getQuantityValue(extra?.quantity ?? extra?.qty ?? extra?.units ?? 1);
    segments.push(`${label} x ${formatQuantity(qty || 1)}`);
  });

  const extrasText = segments.slice(2).join(", ");
  return extrasText ? `${segments[0]} | ${segments[1]} | Extras: ${extrasText}` : `${segments[0]} | ${segments[1]}`;
};

export const getDeliveryStatusPriority = (status) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "PENDING" || normalized === "OUT_FOR_DELIVERY" || normalized === "IN_TRANSIT") return 0;
  if (normalized === "FAILED") return 1;
  if (normalized === "COMPLETED") return 2;
  return 3;
};

export const mergeCustomerDeliveries = (deliveries = []) => {
  const lines = deliveries.map((delivery) => getCustomerProductSummary(delivery));
  const mergedSummary = lines.join(" | ");
  const primaryDelivery =
    [...deliveries].sort(
      (left, right) =>
        getDeliveryStatusPriority(left?.status) - getDeliveryStatusPriority(right?.status) ||
        String(left?.id || "").localeCompare(String(right?.id || ""))
    )[0] || null;

  const totalAmountDue = deliveries.reduce((total, delivery) => {
    const due = Number(delivery?.amountDue || 0);
    return total + (Number.isFinite(due) && due > 0 ? due : 0);
  }, 0);

  const requiresPaymentCollection = deliveries.some((delivery) => {
    const status = String(delivery?.status || "").toUpperCase();
    return (
      Boolean(delivery?.requiresPaymentCollection) &&
      (status === "PENDING" || status === "OUT_FOR_DELIVERY" || status === "IN_TRANSIT")
    );
  });

  return {
    primaryDelivery,
    mergedSummary,
    mergedCount: deliveries.length,
    requiresPaymentCollection,
    totalAmountDue,
  };
};

export const buildDynamicPropertyHierarchy = (deliveries = []) => {
  const hasWings = deliveries.some((d) => Boolean(getWingName(d)));
  const buildingName = deliveries[0] ? getBuildingName(deliveries[0]) : "Unknown Building";

  const calculateStats = (items = []) => {
    const totalCount = items.length;
    let pendingCount = 0;
    let completedCount = 0;
    let failedCount = 0;

    items.forEach((item) => {
      const status = String(item?.status || "").toUpperCase();
      if (status === "COMPLETED") {
        completedCount += 1;
      } else if (status === "FAILED") {
        failedCount += 1;
      } else {
        pendingCount += 1;
      }
    });

    const isCompleted = totalCount > 0 && pendingCount === 0;

    return {
      totalCount,
      pendingCount,
      completedCount,
      failedCount,
      isCompleted,
    };
  };

  const buildingStats = calculateStats(deliveries);

  const groupFloorDeliveries = (floorDeliveries = []) => {
    const floorsMap = new Map();

    floorDeliveries.forEach((delivery) => {
      const floorInfo = getFloorInfo(delivery);
      const floorKey = floorInfo.label;

      if (!floorsMap.has(floorKey)) {
        floorsMap.set(floorKey, {
          floorLabel: floorInfo.label,
          floorNumber: floorInfo.numeric,
          rawFloor: floorInfo.raw,
          deliveries: [],
        });
      }
      floorsMap.get(floorKey).deliveries.push(delivery);
    });

    return [...floorsMap.values()].map((floor) => {
      const floorStats = calculateStats(floor.deliveries);

      const unitsMap = new Map();
      floor.deliveries.forEach((delivery) => {
        const unitLabel = getUnitLabel(delivery);
        const unitKey = unitLabel.toLowerCase();

        if (!unitsMap.has(unitKey)) {
          unitsMap.set(unitKey, {
            unitKey,
            unitLabel,
            deliveries: [],
          });
        }
        unitsMap.get(unitKey).deliveries.push(delivery);
      });

      const units = [...unitsMap.values()].map((unit) => {
        const unitStats = calculateStats(unit.deliveries);

        const customerMap = new Map();
        unit.deliveries.forEach((delivery) => {
          const custName = getCustomerName(delivery);
          const custId = String(delivery.customerId || delivery.customer_id || custName).trim();
          const custKey = `${custName.toLowerCase()}|${custId}`;

          if (!customerMap.has(custKey)) {
            customerMap.set(custKey, {
              id: `${unit.unitKey}|${custKey}`,
              customerName: custName,
              unitLabel: unit.unitLabel,
              flatLabel: getFlatLabel(delivery),
              deliveries: [],
            });
          }
          customerMap.get(custKey).deliveries.push(delivery);
        });

        const customers = [...customerMap.values()].map((cust) => {
          const merged = mergeCustomerDeliveries(cust.deliveries);
          const custStats = calculateStats(cust.deliveries);

          return {
            ...cust,
            primaryDelivery: merged.primaryDelivery,
            mergedSummary: merged.mergedSummary,
            mergedCount: merged.mergedCount,
            requiresPaymentCollection: merged.requiresPaymentCollection,
            totalAmountDue: merged.totalAmountDue,
            isCompleted: custStats.isCompleted,
            isFailed: custStats.failedCount > 0 && custStats.pendingCount === 0 && custStats.completedCount === 0,
            isPending: custStats.pendingCount > 0,
            status: custStats.isCompleted
              ? "COMPLETED"
              : custStats.failedCount > 0 && custStats.pendingCount === 0
              ? "FAILED"
              : "PENDING",
          };
        }).sort((left, right) => {
          if (left.isPending !== right.isPending) {
            return left.isPending ? -1 : 1;
          }
          return left.customerName.localeCompare(right.customerName, undefined, { sensitivity: "base" });
        });

        return {
          unitKey: unit.unitKey,
          unitLabel: unit.unitLabel,
          ...unitStats,
          customers,
        };
      }).sort((left, right) => {
        // Section 19: COMPLETED FLATS/UNITS MOVE TO THE END
        if (left.isCompleted !== right.isCompleted) {
          return left.isCompleted ? 1 : -1;
        }
        return compareFlatLabels(left.unitLabel, right.unitLabel);
      });

      return {
        floorLabel: floor.floorLabel,
        floorNumber: floor.floorNumber,
        ...floorStats,
        units,
      };
    }).sort((left, right) => {
      // Section 18: COMPLETED FLOORS MOVE TO THE END
      if (left.isCompleted !== right.isCompleted) {
        return left.isCompleted ? 1 : -1;
      }
      if (left.floorNumber !== right.floorNumber) {
        return left.floorNumber - right.floorNumber;
      }
      return left.floorLabel.localeCompare(right.floorLabel, undefined, { sensitivity: "base" });
    });
  };

  let wings = [];
  let floors = [];

  if (hasWings) {
    const wingsMap = new Map();

    deliveries.forEach((delivery) => {
      const wingName = getWingName(delivery) || "General";
      if (!wingsMap.has(wingName)) {
        wingsMap.set(wingName, {
          wingName,
          deliveries: [],
        });
      }
      wingsMap.get(wingName).deliveries.push(delivery);
    });

    wings = [...wingsMap.values()].map((wing) => {
      const wingStats = calculateStats(wing.deliveries);
      const wingFloors = groupFloorDeliveries(wing.deliveries);

      return {
        wingName: wing.wingName,
        ...wingStats,
        floors: wingFloors,
      };
    }).sort((left, right) => {
      // Section 20: COMPLETED WINGS MOVE TO THE END
      if (left.isCompleted !== right.isCompleted) {
        return left.isCompleted ? 1 : -1;
      }
      return left.wingName.localeCompare(right.wingName, undefined, { sensitivity: "base" });
    });
  } else {
    floors = groupFloorDeliveries(deliveries);
  }

  return {
    buildingName,
    hasWings,
    ...buildingStats,
    wings,
    floors,
  };
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
    const size = sizeLabel || String(delivery?.sizeLabel || delivery?.size || delivery?.unit || delivery?.weight || "").trim();

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

export const getCompactDeliverySummary = (deliveries = []) => {
  if (!deliveries || !deliveries.length) return "";
  const summary = calculateDetailedDeliverySummary(deliveries);
  const parts = [];

  if (summary.milkTypes && summary.milkTypes.length > 0) {
    summary.milkTypes.forEach((milk) => {
      const breakdownText = milk.breakdown.map((b) => `${b.sizeLabel} × ${b.packets}`).join(", ");
      parts.push(`${milk.name} • ${breakdownText}`);
    });
  }

  if (summary.extraProducts && summary.extraProducts.length > 0) {
    summary.extraProducts.forEach((extra) => {
      parts.push(`${extra.name}${extra.sizeLabel ? ` (${extra.sizeLabel})` : ""} × ${extra.packets}`);
    });
  }

  if (!parts.length) {
    const first = deliveries[0];
    const label = getProductLabel(first) || "Milk";
    const qty = formatQuantity(first?.quantity_liters || first?.quantity || 1);
    return `${label} • ${qty} L`;
  }

  return parts.join(" • ");
};


