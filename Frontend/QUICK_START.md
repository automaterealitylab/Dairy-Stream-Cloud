# Capacitor Quick Start Checklist

## Before You Start
- [ ] Node.js v16+ installed (`node --version`)
- [ ] npm installed (`npm --version`)
- [ ] You're in the `Frontend` directory
- [ ] Your app runs fine with `npm run dev`

## Installation Steps (Run in Order)

### Step 1: Install Capacitor (2 min)
```bash
npm install @capacitor/core @capacitor/cli
```

### Step 2: Install Native Platforms
```bash
npm install @capacitor/android @capacitor/ios
```

### Step 3: Install Optional Plugins (Skip if not needed)
```bash
# Only if you use geolocation, camera, push notifications, etc.
npm install @capacitor/geolocation @capacitor/push-notifications
```

### Step 4: Initialize Capacitor (1 min)
```bash
npx cap init
```
- App name: `Dairy Stream`
- Package ID: `com.dairystream.app`
- Web dir: `dist`

### Step 5: Build Your Web App (2-3 min)
```bash
npm run build
```

### Step 6: Add Android
```bash
npx cap add android
```
- Creates `android/` folder

### Step 7: Add iOS (Mac Only)
```bash
npx cap add ios
```
- Creates `ios/` folder

### Step 8: Sync Files
```bash
npx cap sync
```

## After Installation

### For Android Development
```bash
npx cap open android
```
- Opens Android Studio
- Click "Run" to test on emulator/device

### For iOS Development (Mac)
```bash
npx cap open ios
```
- Opens Xcode
- Select device and click "Play" to test

## After Each Code Change

1. **Rebuild web app:**
   ```bash
   npm run build
   ```

2. **Sync to native projects:**
   ```bash
   npx cap sync
   ```

3. **Re-run in Android Studio or Xcode**

## Testing Steps

- [ ] Web app works: `npm run dev` → check http://localhost:5173
- [ ] Build works: `npm run build` → check `dist/` folder exists
- [ ] Android app builds in Android Studio
- [ ] iOS app builds in Xcode
- [ ] App connects to your backend API
- [ ] All features work (login, navigation, etc.)

## When Ready for App Stores

### Android (Google Play Store)
```bash
# In Android Studio:
# 1. Build > Generate Signed Bundle/APK
# 2. Follow wizard
# 3. Upload to Google Play Console
```

### iOS (Apple App Store)
```bash
# In Xcode:
# 1. Product > Archive
# 2. Upload to App Store Connect
# 3. Wait for Apple review
```

## Troubleshooting Commands

```bash
# Check if everything is set up correctly
npx cap doctor

# Re-sync files if something breaks
npx cap sync --fresh

# Update Capacitor
npm update @capacitor/core @capacitor/cli

# View Capacitor version
npx cap --version
```

---

**💡 Pro Tips:**
- Test on real device before publishing (app store)
- Keep `capacitor.config.ts` updated with correct URLs
- Use absolute URLs for API calls (not relative paths)
- Enable Android/iOS permissions in config when needed

**Need Help?**
- Capacitor Docs: https://capacitorjs.com/docs
- Android Docs: https://developer.android.com/
- iOS Docs: https://developer.apple.com/documentation/
