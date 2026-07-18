# Capacitor Permissions & Plugins Setup

## iOS Permissions (Info.plist)

Xcode automatically manages these, but you can also add to `ios/App/App/Info.plist`:

```xml
<!-- Geolocation -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to show delivery routes</string>

<!-- Camera -->
<key>NSCameraUsageDescription</key>
<string>We need camera access to scan QR codes</string>

<!-- Photo Library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photos</string>

<!-- Microphone (if needed) -->
<key>NSMicrophoneUsageDescription</key>
<string>We need microphone access for calls</string>
```

## Android Permissions (AndroidManifest.xml)

Located at: `android/app/src/main/AndroidManifest.xml`

Already included after `npx cap add android`, but verify these are present:

```xml
<!-- Internet -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Geolocation -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Camera -->
<uses-permission android:name="android.permission.CAMERA" />

<!-- Photos -->
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Background Location (Optional) -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
```

## Plugin Installation & Usage

### Push Notifications

**Install:**
```bash
npm install @capacitor/push-notifications
npx cap sync
```

**Android Setup (Firebase):**
1. Go to Firebase Console
2. Create project / select existing
3. Add Android app
4. Download `google-services.json`
5. Place in `android/app/`

**iOS Setup (Apple Push):**
1. Go to Apple Developer
2. Create certificate for Push Notifications
3. Download and add to Xcode

**Usage:**
```javascript
import { PushNotifications } from '@capacitor/push-notifications'

// Request permission
await PushNotifications.requestPermissions()

// Listen for notifications
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('Notification received:', notification)
})
```

### Geolocation

**Install:**
```bash
npm install @capacitor/geolocation
npx cap sync
```

**Usage:**
```javascript
import { Geolocation } from '@capacitor/geolocation'

// Get current location
const coordinates = await Geolocation.getCurrentPosition()
console.log('Lat:', coordinates.coords.latitude)
console.log('Long:', coordinates.coords.longitude)

// Watch location changes
const watchId = await Geolocation.watchPosition(
  {},
  (position) => {
    console.log('New position:', position)
  }
)
```

**iOS: Add to Info.plist (Xcode)**
- Select App target
- Info tab
- Add "Privacy - Location When In Use Usage Description"

**Android: Add to AndroidManifest.xml**
```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### Camera

**Install:**
```bash
npm install @capacitor/camera
npx cap sync
```

**Usage:**
```javascript
import { Camera, CameraResultType } from '@capacitor/camera'

const photo = await Camera.getPhoto({
  quality: 90,
  allowEditing: true,
  resultType: CameraResultType.Uri,
})

console.log('Photo path:', photo.webPath)
```

### File System

**Install:**
```bash
npm install @capacitor/filesystem
npx cap sync
```

**Usage:**
```javascript
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

// Write file
await Filesystem.writeFile({
  path: 'myfile.txt',
  data: 'Hello World',
  directory: Directory.Documents,
  encoding: Encoding.UTF8,
})

// Read file
const contents = await Filesystem.readFile({
  path: 'myfile.txt',
  directory: Directory.Documents,
  encoding: Encoding.UTF8,
})
```

## Status Bar & Splash Screen

### Splash Screen

**Updated in capacitor.config.ts:**
```typescript
plugins: {
  SplashScreen: {
    launchShowDuration: 3000,  // Show for 3 seconds
    backgroundColor: '#1a1a1a',
    showSpinner: true,
    androidScaleType: 'CENTER_CROP',
  },
}
```

### Status Bar

**Install:**
```bash
npm install @capacitor/status-bar
npx cap sync
```

**Usage:**
```javascript
import { StatusBar, Style } from '@capacitor/status-bar'

// Set status bar style
await StatusBar.setStyle({ style: Style.Dark })

// Set background color
await StatusBar.setBackgroundColor({ color: '#1a1a1a' })
```

## Network Status

**Install:**
```bash
npm install @capacitor/network
npx cap sync
```

**Usage:**
```javascript
import { Network } from '@capacitor/network'

// Check current status
const status = await Network.getStatus()
console.log('Connected:', status.connected)

// Listen for changes
Network.addListener('networkStatusChange', (status) => {
  console.log('Network changed. Connected:', status.connected)
})
```

## Keyboard

**Install:**
```bash
npm install @capacitor/keyboard
npx cap sync
```

**Usage:**
```javascript
import { Keyboard } from '@capacitor/keyboard'

// Hide keyboard
Keyboard.hide()

// Show keyboard
Keyboard.show()

// Listen for events
Keyboard.addListener('keyboardWillShow', (info) => {
  console.log('Keyboard height:', info.keyboardHeight)
})
```

## Checklist for Your App

Based on Dairy Stream features, you likely need:

- [ ] Geolocation (delivery tracking)
- [ ] Camera (QR code scanning) 
- [ ] Filesystem (cache data)
- [ ] Network (check connectivity)
- [ ] Push Notifications (delivery updates)
- [ ] Status Bar (UI polish)

**Install these in one command:**
```bash
npm install @capacitor/geolocation @capacitor/camera @capacitor/filesystem @capacitor/network @capacitor/push-notifications @capacitor/status-bar @capacitor/keyboard
npx cap sync
```

Then configure each in `capacitor.config.ts` as needed.
