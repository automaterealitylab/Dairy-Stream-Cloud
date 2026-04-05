import { API_BASE_URL } from "../api/client";
import { getPendingDeliveries, clearPendingDeliveries } from "./deliveryQueue";

export const syncDeliveries = async () => {
  const pending = await getPendingDeliveries();

  for (const delivery of pending) {
    await fetch(`${API_BASE_URL}/agent/update-delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(delivery),
    });
  }

  await clearPendingDeliveries();
};
