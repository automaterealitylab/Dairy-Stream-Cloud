# Fix Network Error on Physical Device

I have applied the following fixes to resolve the "network error" during login:

1.  **Enabled Cleartext Traffic:** Updated `AndroidManifest.xml` to allow HTTP connections. This is necessary because your local backend runs on `http`, not `https`.
2.  **Configured API Base URL:** Created a `.env` file in the `Frontend` directory with your computer's local IP address (`10.116.203.163`). This ensures the app points to your computer instead of `localhost`.

## Changes Made

### Android Manifest
- [AndroidManifest.xml](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/android/app/src/main/AndroidManifest.xml)
    - Added `android:usesCleartextTraffic="true"` to the `<application>` tag.

### Frontend Configuration
- [NEW] [.env](file:///C:/Users/swapn/OneDrive/Documents/project/Dairy-Stream-Cloud/Frontend/.env)
    - Added `VITE_API_BASE_URL=http://10.116.203.163:4000`.

## Next Steps for You

Since these changes involve both the Android configuration and the web assets, you need to rebuild and sync the app:

1.  **Rebuild Web Assets:** In your terminal (in the `Frontend` folder), run:
    ```bash
    npm run build
    ```
2.  **Sync Capacitor:** Run:
    ```bash
    npx cap sync android
    ```
3.  **Run the App:** Re-deploy the app to your phone from Android Studio.

> [!IMPORTANT]
> Ensure your phone is connected to the same Wi-Fi network as your computer.
