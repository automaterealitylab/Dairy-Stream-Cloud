self.addEventListener("sync", (event) => {
  if (event.tag === "sync-deliveries") {
    event.waitUntil(syncDeliveries());
  }
});
