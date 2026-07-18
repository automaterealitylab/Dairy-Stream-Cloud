# Fix Network Error on Physical Device

The network error is likely caused by the app trying to connect to `localhost:4000`. On a physical device, `localhost` refers to the device itself, not your development machine. Additionally, Android blocks cleartext (HTTP) traffic by default.

## User Review Required

> [!IMPORTANT]
> You need to provide your computer's local IP address (e.g., `192.168.1.10`) so the app can reach the backend server running on your machine.
> Both your phone and computer must be connected to the same Wi-Fi network.

## Proposed Changes

### Frontend API Configuration

#### [MODIFY] [client.js](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/src/api/client.js)
Update the `BASE_URL` to use your computer's local IP address instead of `localhost`.

#### [MODIFY] [adminDebug.js](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/src/utils/adminDebug.js)
Similarly, update the debug base URL.

### Android Manifest Configuration

#### [MODIFY] [AndroidManifest.xml](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/android/app/src/main/AndroidManifest.xml)
Enable `android:usesCleartextTraffic="true"` in the `<application>` tag to allow HTTP connections (since the local backend usually runs on HTTP).

## Verification Plan

### Manual Verification
1. Open a terminal on your computer and run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) to find your IPv4 address.
2. Update the `BASE_URL` with that IP address.
3. Re-build and deploy the app to your phone.
4. Try logging in again.
