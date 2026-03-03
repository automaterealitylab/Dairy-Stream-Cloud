/**
 * Offline Sync Manager
 * Handles syncing of deliveries, proofs, and other data when coming back online
 */

class OfflineSyncManager {
  constructor() {
    this.pendingDeliveries = [];
    this.pendingProofs = [];
    this.isSyncing = false;
  }

  // Add pending delivery to queue
  addPendingDelivery(delivery) {
    try {
      const pending = JSON.parse(
        localStorage.getItem('pendingDeliveries') || '[]'
      );
      pending.push({
        ...delivery,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('pendingDeliveries', JSON.stringify(pending));
      return true;
    } catch (error) {
      console.error('Error adding pending delivery:', error);
      return false;
    }
  }

  // Add pending proof to queue
  addPendingProof(proof) {
    try {
      const pending = JSON.parse(
        localStorage.getItem('pendingProofs') || '[]'
      );
      pending.push({
        ...proof,
        timestamp: new Date().toISOString(),
      });
      localStorage.setItem('pendingProofs', JSON.stringify(pending));
      return true;
    } catch (error) {
      console.error('Error adding pending proof:', error);
      return false;
    }
  }

  // Get all pending items
  getPendingItems() {
    try {
      const deliveries = JSON.parse(
        localStorage.getItem('pendingDeliveries') || '[]'
      );
      const proofs = JSON.parse(
        localStorage.getItem('pendingProofs') || '[]'
      );
      return { deliveries, proofs };
    } catch (error) {
      console.error('Error retrieving pending items:', error);
      return { deliveries: [], proofs: [] };
    }
  }

  // Sync pending items with server
  async syncPendingItems(api) {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return false;
    }

    this.isSyncing = true;

    try {
      const { deliveries, proofs } = this.getPendingItems();
      let successCount = 0;
      let failedCount = 0;

      // Sync deliveries
      for (const delivery of deliveries) {
        try {
          await this.syncDelivery(delivery, api);
          successCount++;
        } catch (error) {
          console.error('Failed to sync delivery:', error);
          failedCount++;
        }
      }

      // Sync proofs
      for (const proof of proofs) {
        try {
          await this.syncProof(proof, api);
          successCount++;
        } catch (error) {
          console.error('Failed to sync proof:', error);
          failedCount++;
        }
      }

      // Clear localStorage if all synced successfully
      if (failedCount === 0) {
        localStorage.removeItem('pendingDeliveries');
        localStorage.removeItem('pendingProofs');
      }

      return { successCount, failedCount, success: failedCount === 0 };
    } catch (error) {
      console.error('Sync error:', error);
      return { successCount: 0, failedCount: 0, success: false };
    } finally {
      this.isSyncing = false;
    }
  }

  // Sync individual delivery
  async syncDelivery(delivery, api) {
    try {
      // Implement actual API call based on your API
      // await api.deliveryAPI.updateDeliveryStatus(delivery.id, delivery.status);
      console.log('Syncing delivery:', delivery.id);
    } catch (error) {
      console.error('Error syncing delivery:', error);
      throw error;
    }
  }

  // Sync individual proof
  async syncProof(proof, api) {
    try {
      // Implement actual API call based on your API
      // await api.deliveryAPI.submitDeliveryProof(proof.deliveryId, proof.proofType, proof.file);
      console.log('Syncing proof:', proof.deliveryId);
    } catch (error) {
      console.error('Error syncing proof:', error);
      throw error;
    }
  }

  // Get pending item count
  getPendingCount() {
    const { deliveries, proofs } = this.getPendingItems();
    return deliveries.length + proofs.length;
  }

  // Clear all pending items
  clearPendingItems() {
    localStorage.removeItem('pendingDeliveries');
    localStorage.removeItem('pendingProofs');
  }
}

export const offlineSyncManager = new OfflineSyncManager();

/**
 * Delivery Manager
 * Handles delivery status updates with offline support
 */

export class DeliveryManager {
  static async updateDeliveryStatus(deliveryId, status, api) {
    try {
      if (navigator.onLine) {
        // Online - update via API
        const response = await api.deliveryAPI.updateDeliveryStatus(
          deliveryId,
          status
        );
        return response.data;
      } else {
        // Offline - add to pending queue
        offlineSyncManager.addPendingDelivery({
          id: deliveryId,
          status,
          type: 'status_update',
        });
        return { offlineMode: true };
      }
    } catch (error) {
      console.error('Error updating delivery status:', error);
      // Fallback to offline mode
      offlineSyncManager.addPendingDelivery({
        id: deliveryId,
        status,
        type: 'status_update',
      });
      throw error;
    }
  }

  static async submitDeliveryProof(deliveryId, proofType, file, otp, api) {
    try {
      if (navigator.onLine) {
        // Online - submit via API
        const response = await api.deliveryAPI.submitDeliveryProof(
          deliveryId,
          proofType,
          file,
          otp
        );
        return response.data;
      } else {
        // Offline - add to pending queue
        offlineSyncManager.addPendingProof({
          deliveryId,
          proofType,
          file,
          otp,
        });
        return { offlineMode: true };
      }
    } catch (error) {
      console.error('Error submitting proof:', error);
      // Fallback to offline mode
      offlineSyncManager.addPendingProof({
        deliveryId,
        proofType,
        file,
        otp,
      });
      throw error;
    }
  }

  static async markDeliveryFailed(
    deliveryId,
    reason,
    reasonDetails,
    file,
    api
  ) {
    try {
      if (navigator.onLine) {
        // Online - submit via API
        const response = await api.deliveryAPI.markDeliveryFailed(
          deliveryId,
          reason,
          reasonDetails,
          file
        );
        return response.data;
      } else {
        // Offline - add to pending queue
        offlineSyncManager.addPendingDelivery({
          id: deliveryId,
          reason,
          reasonDetails,
          file,
          type: 'failed_delivery',
        });
        return { offlineMode: true };
      }
    } catch (error) {
      console.error('Error marking delivery failed:', error);
      // Fallback to offline mode
      offlineSyncManager.addPendingDelivery({
        id: deliveryId,
        reason,
        reasonDetails,
        file,
        type: 'failed_delivery',
      });
      throw error;
    }
  }
}

export default {
  offlineSyncManager,
  DeliveryManager,
};
