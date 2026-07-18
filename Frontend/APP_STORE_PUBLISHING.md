# Publishing to App Stores (Google Play & Apple App Store)

## Before Publishing

- [ ] App fully tested on Android device/emulator
- [ ] App fully tested on iOS device/simulator  
- [ ] All features working correctly
- [ ] Backend API is production-ready
- [ ] Privacy Policy written
- [ ] Terms of Service written
- [ ] App icon created (512x512 PNG minimum)
- [ ] Screenshots for store listing

---

## Part 1: Publishing to Google Play Store (Android)

### Prerequisites
- Google Play Developer Account ($25 one-time fee)
- Signed APK/AAB file

### Step 1: Create Signed Bundle

**In Android Studio:**

1. Click `Build` → `Generate Signed Bundle / APK`
2. Select `Android App Bundle` (recommended for Play Store)
3. Create new keystore:
   - Keystore path: `android/app/dairy-stream.jks` (or your path)
   - Password: *(strong password, save it!)*
   - Alias: `dairy-stream`
   - Key password: *(same as above)*
   - Validity: 25 years
   - Fill in your info
4. Select `Release`
5. Click `Finish`

**Output location:** `android/app/release/app-release.aab`

### Step 2: Prepare Store Listing

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Fill in app details:
   - **App name:** Dairy Stream
   - **Short description** (80 chars): "Manage dairy deliveries efficiently"
   - **Full description:** Write 500+ word description
   - **Category:** Business or Productivity
   - **Content rating:** Fill questionnaire
   - **Target audience:** Adult
   - **Permissions:** Accept default
4. Upload screenshots (5-8 images recommended)
   - 1080x1920 pixels (Portrait)
   - Feature graphic
   - Icon (512x512)

### Step 3: Upload APK/AAB

1. Go to `Release` → `Production`
2. Upload your `app-release.aab`
3. Add release notes: "First release"
4. Review all information
5. Click `Review` → `Start rollout to Production`

### Step 4: Wait for Review

- Initial review: 2-3 hours to 3 days
- Check email for status updates
- Once approved, live on Play Store!

---

## Part 2: Publishing to Apple App Store (iOS)

### Prerequisites
- Mac computer
- Apple Developer Account ($99/year)
- Valid paid Apple Developer Account (not free)
- App Signing Certificate + Provisioning Profile

### Step 1: Prepare Certificates & Profiles

**In Xcode:**

1. Open `App` project in Xcode
2. Select `App` target
3. Go to `Signing & Capabilities` tab
4. Select your team (create if needed)
5. Enable Automatic Signing
6. Xcode will handle certificates automatically

### Step 2: Archive Your App

1. Select iOS device → `Generic iOS Device`
2. Click `Product` → `Archive`
3. Wait for build to complete
4. Window opens with archives
5. Select your archive → Click `Distribute App`

### Step 3: Choose Distribution Method

- Select `App Store Connect`
- Select `Upload`
- Automatically manage signing (default)
- Click `Next` and follow wizard

### Step 4: Create App Store Connect Listing

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app:
   - Platform: iOS
   - App name: Dairy Stream
   - Bundle ID: `com.dairystream.app`
   - SKU: `dairy-stream-001` (unique)
3. Fill metadata:
   - **Description:** 4000 character limit
   - **Keywords:** delivery, dairy, management
   - **Support URL:** your website
   - **Privacy Policy URL:** your privacy policy
   - **Screenshot:** 1170x2532 pixels (5 minimum)
   - **Category:** Business
   - **Content rating:** Fill questionnaire

### Step 5: Submit for Review

1. Go to `TestFlight` (optional - test with beta users first)
2. Click `Submit for Review`
3. Answer compliance questions:
   - Encryption: Select appropriate option
   - Advertising: No if applicable
4. Click `Submit`

### Step 6: Wait for Review

- Apple review: 24-48 hours typically
- Check email for status
- May request changes (common)
- Once approved, live on App Store!

---

## Troubleshooting

### Android Issues

**"Build fails on sync"**
```bash
cd android
./gradlew clean build -x lint
cd ..
npx cap sync
```

**"APK is too large"**
- Enable ProGuard/R8 optimization
- Remove unused dependencies
- Use App Bundle instead of APK

**"App crashes on launch"**
- Check logcat: `adb logcat`
- Ensure API_URL is correct
- Check CORS settings on backend

### iOS Issues

**"Code signing failed"**
- Go to Xcode → Preferences → Accounts
- Click manage certificates
- Create/revoke certificates as needed
- Re-enable automatic signing

**"Archive failed"**
```bash
cd ios
pod repo update
cd ..
npx cap sync
```

**"App rejected by Apple"**
- Common reasons: Crash on launch, metadata issues
- Fix issues and resubmit
- Apple reviews only updated version

---

## Store Optimization Tips

### Screenshots
- Show main features clearly
- Use text overlays to highlight benefits
- 5-8 screenshots recommended
- Consistent branding

### Description
- **First 80 chars appear as headline**
- Highlight key features
- Include app benefits
- Clear call-to-action

### Ratings & Reviews
- Respond to negative reviews professionally
- Fix reported bugs quickly
- Update app frequently

### Pricing & In-App Purchases
- Start free if possible
- Premium tiers increase conversion
- Be transparent about pricing

---

## After Launch

### Monitor Performance
- Check crash rates: Crashes section in store
- Monitor user ratings
- Read reviews for feedback

### Update Strategy
- Small regular updates beat big rare ones
- Bug fixes get priority
- Test thoroughly before release

### Marketing
- Share release with users
- Create demo videos
- Post on social media
- Ask satisfied users to rate

---

## Useful Links

- Android Publishing: https://developer.android.com/guide/google-play/console
- iOS Publishing: https://developer.apple.com/app-store/
- App Store Connect: https://appstoreconnect.apple.com
- Google Play Console: https://play.google.com/console
- Capacitor Deployment: https://capacitorjs.com/docs/guides/deploying-to-app-stores

---

## Estimated Costs

| Item | Cost | Frequency |
|------|------|-----------|
| Google Play Developer | $25 | One-time |
| Apple Developer | $99 | Annual |
| App Signing Certificate | Free | Included |
| Total First Year | $124 | - |
| Total Following Years | $99 | Annual |

---

## Timeline Estimate

- **Android Play Store:** 1-2 weeks (mostly review time)
- **iOS App Store:** 1-2 weeks (mostly review time)
- **Total:** 2-3 weeks for both

**Note:** Plan ahead - submit to both stores simultaneously!
