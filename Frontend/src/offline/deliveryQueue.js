import { openDB } from "idb";

const DB_NAME = "dairy-offline-db";
const STORE = "pending-deliveries";

export const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
  },
});

export const savePendingDelivery = async (delivery) => {
  const db = await dbPromise;
  await db.add(STORE, delivery);
};

export const getPendingDeliveries = async () => {
  const db = await dbPromise;
  return db.getAll(STORE);
};

export const clearPendingDeliveries = async () => {
  const db = await dbPromise;
  const tx = db.transaction(STORE, "readwrite");
  await tx.store.clear();
  await tx.done;
};
