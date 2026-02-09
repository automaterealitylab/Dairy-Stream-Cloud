import webpush from "web-push";

// Load from env
webpush.setVapidDetails(
  "mailto:admin@dairystream.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export const sendNotification = async (subscription, payload) => {
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error("Push error:", err.message);
  }
};
