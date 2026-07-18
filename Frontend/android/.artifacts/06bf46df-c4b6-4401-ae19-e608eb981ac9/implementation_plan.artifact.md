# Fix Persistent Network Error on Physical Device

The previous fixes enabled cleartext traffic and set the IP address, but the network error persists. This is likely due to the backend's security configuration (CORS) or the server not listening on all network interfaces.

## User Review Required

> [!IMPORTANT]
> **Check your Firewall:** Ensure that your computer's firewall is not blocking incoming connections on port **4000**.
> **Same Network:** Double-check that your phone and computer are on the same Wi-Fi.

## Proposed Changes

### Backend Configuration

#### [MODIFY] [server.js](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/server.js)
Explicitly set the server to listen on `0.0.0.0` so it accepts connections from other devices on the network.

#### [MODIFY] [.env](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Backend/.env)
Update `CORS_ORIGINS` to include Capacitor's default origins (`https://localhost`, `capacitor://localhost`).

### Frontend Configuration (Double Check)

#### [MODIFY] [capacitor.config.ts](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/capacitor.config.ts)
Temporarily disable the `https` scheme for the internal server to ensure it matches the `http` backend calls better, or ensure the backend accepts the `https` origin. (We will try adding origins first).

## Verification Plan

### Manual Verification
1. Restart the backend server after applying changes.
2. Re-build and re-deploy the frontend.
3. Test login.
