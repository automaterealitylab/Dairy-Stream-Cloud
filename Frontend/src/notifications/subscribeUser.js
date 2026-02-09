export const subscribeUser = async () => {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: import.meta.env.VITE_VAPID_KEY,
  });

  await fetch("/api/notifications/subscribe", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
};
