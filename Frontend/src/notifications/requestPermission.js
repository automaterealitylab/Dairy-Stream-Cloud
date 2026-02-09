export const requestNotificationPermission = async () => {
  const permission = await Notification.requestPermission();
  return permission === "granted";
};
