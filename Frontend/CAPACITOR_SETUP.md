# Capacitor Setup Guide for Dairy Stream

## Prerequisites
- Node.js and npm installed
- For iOS: Mac with Xcode installed
- For Android: Android Studio or Android SDK installed

## Step 1: Install Capacitor & Core Plugins

Run these commands in the **Frontend** directory:

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios

# Optional plugins you might need:
npm install @capacitor/push-notifications
npm install @capacitor/geolocation
npm install @capacitor/camera
npm install @capacitor/filesystem
npm install @capacitor/splash-screen
npm install @capacitor/status-bar
```

## Step 2: Initialize Capacitor

```bash
# In the Frontend directory
npx cap init
```

When prompted:
- App name: `Dairy Stream`
- App Package ID: `com.dairystream.app`
- Web dir: `dist`

## Step 3: Build Your React App

```bash
npm run build
```

This creates the `dist` folder that Capacitor will wrap.

## Step 4: Add Android Platform

```bash
npx cap add android
```

This creates the `android` folder for Android app.

## Step 5: Add iOS Platform (Mac Only)

```bash
npx cap add ios
```

This creates the `ios` folder for iOS app.

## Step 6: Sync Files

```bash
npx cap sync
```

This copies your web app files to the native projects.

## Development Workflow

### Web Development
```bash
npm run dev      # Run dev server (http://localhost:5173)
npm run build    # Build for production
```

### Android Testing
```bash
npx cap open android
# Opens Android Studio - build and run from there
# Or run on emulator/device
```

### iOS Testing (Mac Only)
```bash
npx cap open ios
# Opens Xcode - build and run from there
```

## Important: Environment Variables

If your app uses environment variables, create `.env` file in Frontend:

```env
VITE_API_URL=https://your-api-domain.com
VITE_SOCKET_URL=https://your-socket-domain.com
```

## Important: API/Socket Communication

Make sure your backend API and Socket.IO URLs are **absolute URLs** (not relative):

**WRONG:**
```javascript
const API_URL = '/api'  // Won't work in native app
```

**RIGHT:**
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'https://your-api.com'
```

## App Store Publishing Requirements

### For Play Store (Android)
1. Google Play Developer Account ($25 one-time)
2. Build APK/AAB in Android Studio
3. Upload to Google Play Console

### For App Store (iOS)
1. Apple Developer Account ($99/year)
2. Build in Xcode
3. Upload via App Store Connect
4. Apple review process (24-48 hours)

## Useful Commands

```bash
npx cap sync           # Sync web files to native projects
npx cap open android   # Open Android Studio
npx cap open ios       # Open Xcode
npx cap update         # Update Capacitor packages
npx cap doctor         # Check your setup
```

## Troubleshooting

### Issue: App shows blank screen
- Ensure `npm run build` was run
- Check `dist` folder exists
- Run `npx cap sync` again

### Issue: API calls fail in native app
- Check if API URL is absolute (not relative)
- Ensure CORS is enabled on backend
- Check internet permissions in AndroidManifest.xml and Info.plist

### Issue: Geolocation not working
- iOS: Add location permission in Xcode
- Android: Request runtime permissions in code

### Issue: Push notifications not working
- Android: Set up Firebase Cloud Messaging (FCM)
- iOS: Set up Apple Push Notifications (APN)

## Next Steps

1. Run Step 1-3 above
2. Test web app works: `npm run dev`
3. Run Step 4 (Android) or Step 5 (iOS)
4. Follow the respective platform guides for building and publishing

Need help? Reference: https://capacitorjs.com/docs
