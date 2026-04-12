/**
 * Simple Route Optimization Utility
 * Groups deliveries by building and optimizes delivery order
 */

/**
 * Extract building/complex name from address
 * @param {string} address - Full address
 * @returns {string} - Building/complex name
 */
const extractBuilding = (deliveryOrAddress) => {
  if (
    deliveryOrAddress &&
    typeof deliveryOrAddress === 'object' &&
    typeof deliveryOrAddress.buildingName === 'string' &&
    deliveryOrAddress.buildingName.trim()
  ) {
    return deliveryOrAddress.buildingName.trim();
  }

  const address =
    typeof deliveryOrAddress === 'string'
      ? deliveryOrAddress
      : String(deliveryOrAddress?.address || '');

  // Extract building name/complex from address
  // Example: "Flat 102, Green Valley Society, Narhe" -> "Green Valley Society"
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[1].trim();
  }
  return address;
};

/**
 * Calculate simple distance score based on address similarity
 * @param {string} addr1 - First address
 * @param {string} addr2 - Second address
 * @returns {number} - Distance score (lower is closer)
 */
const calculateProximityScore = (addr1, addr2) => {
  const building1 = extractBuilding(addr1);
  const building2 = extractBuilding(addr2);
  
  // Same building = score 0 (closest)
  if (building1 === building2) return 0;
  
  // Same area/locality = score 1
  const area1 = addr1.split(',').pop()?.trim() || '';
  const area2 = addr2.split(',').pop()?.trim() || '';
  if (area1 === area2) return 1;
  
  // Different location = score 2
  return 2;
};

/**
 * Group deliveries by building
 * @param {Array} deliveries - Array of delivery objects
 * @returns {Object} - Grouped deliveries by building
 */
export const groupDeliveriesByBuilding = (deliveries) => {
  return deliveries.reduce((groups, delivery) => {
    const building = extractBuilding(delivery);
    if (!groups[building]) {
      groups[building] = [];
    }
    groups[building].push(delivery);
    return groups;
  }, {});
};

/**
 * Optimize route by sorting deliveries by proximity and building grouping
 * @param {Array} deliveries - Array of delivery objects
 * @returns {Array} - Optimized delivery array with building sequence numbers
 */
export const optimizeRoute = (deliveries) => {
  if (!deliveries || deliveries.length === 0) return [];
  
  // Group by building
  const grouped = groupDeliveriesByBuilding(deliveries);
  
  // Sort buildings by name for consistency
  const buildings = Object.keys(grouped).sort();
  
  // Flatten back into optimized order with building sequence numbering
  const optimized = [];
  buildings.forEach(building => {
    // Sort deliveries within building by flat number (numerically if possible)
    const buildingDeliveries = grouped[building].sort((a, b) => {
      const flatA = String(a.roomNo || a.address.split(',')[0] || '').trim();
      const flatB = String(b.roomNo || b.address.split(',')[0] || '').trim();
      
      // Try numeric sort if both start with flat/room numbers
      const numA = parseInt(flatA.match(/\d+/)?.[0] || '0');
      const numB = parseInt(flatB.match(/\d+/)?.[0] || '0');
      
      if (numA !== 0 && numB !== 0) {
        return numA - numB;
      }
      
      return flatA.localeCompare(flatB);
    });
    
    // Add building sequence number to each delivery
    buildingDeliveries.forEach((delivery, index) => {
      optimized.push({
        ...delivery,
        buildingSequence: index + 1,
        buildingName: building
      });
    });
  });
  
  return optimized;
};

/**
 * Get route optimization summary
 * @param {Array} deliveries - Array of delivery objects
 * @returns {Object} - Summary with groups and stats
 */
export const getRouteOptimizationSummary = (deliveries) => {
  const grouped = groupDeliveriesByBuilding(deliveries);
  const buildings = Object.keys(grouped);
  
  return {
    totalDeliveries: deliveries.length,
    totalBuildings: buildings.length,
    groups: Object.entries(grouped).map(([building, delivs], buildingIndex) => ({
      buildingIndex: buildingIndex + 1,
      building,
      count: delivs.length,
      deliveries: delivs.map((delivery, index) => ({
        ...delivery,
        buildingSequence: index + 1,
        buildingName: building
      })),
    })),
  };
};

/**
 * Sort deliveries by status priority then by optimized route
 * @param {Array} deliveries - Array of delivery objects
 * @param {Array} statusPriority - Priority order of statuses (default: PENDING first)
 * @returns {Array} - Sorted deliveries with PENDING prioritized and building sequence numbering
 */
export const optimizeRouteWithPriority = (deliveries, statusPriority = ['PENDING', 'COMPLETED', 'FAILED']) => {
  // First sort by status priority
  const prioritized = [...deliveries].sort((a, b) => {
    const priorityA = statusPriority.indexOf(a.status);
    const priorityB = statusPriority.indexOf(b.status);
    
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    
    // Then within each status, optimize route
    return 0;
  });
  
  // Group by status and optimize each group
  const statusGroups = {};
  prioritized.forEach(delivery => {
    if (!statusGroups[delivery.status]) {
      statusGroups[delivery.status] = [];
    }
    statusGroups[delivery.status].push(delivery);
  });
  
  // Optimize each status group and recombine with building sequence numbering
  const result = [];
  statusPriority.forEach(status => {
    if (statusGroups[status]) {
      const optimized = optimizeRoute(statusGroups[status]);
      result.push(...optimized);
    }
  });
  
  return result;
};
