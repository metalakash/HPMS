# Mobile Deployment Guide (EAS & App Stores)

**Platform:** Expo EAS  
**Stores:** Apple App Store, Google Play Store  
**Framework:** React Native 0.72 + TypeScript 5.1  
**Node:** 18+

---

## Local Development Setup

### Prerequisites
```bash
# Check versions
node --version          # 18+
npm --version           # 9+
npm install -g eas-cli  # EAS CLI
npm install -g expo-cli # Expo CLI
```

### Initial Setup
```bash
# Clone repository
git clone https://github.com/hpms/mobile
cd mobile

# Install dependencies
npm install

# Create .env file
cp .env.example .env
```

### Environment Variables
```env
# API
EXPO_PUBLIC_API_URL=http://localhost:8000/api
EXPO_PUBLIC_ENV=development

# Firebase (Analytics & Crash Reporting)
EXPO_PUBLIC_FIREBASE_PROJECT_ID=hpms-dev
EXPO_PUBLIC_FIREBASE_API_KEY=[key]

# Authentication
EXPO_PUBLIC_AUTH_DOMAIN=localhost:8000

# Feature Flags
EXPO_PUBLIC_FEATURE_CROSS_FEATURE=true
EXPO_PUBLIC_FEATURE_WORKFLOWS=true
```

### Start Development

**iOS Simulator:**
```bash
npm run ios
# or
expo start --ios
```

**Android Emulator:**
```bash
npm run android
# or
expo start --android
```

**Physical Device:**
```bash
# Generate QR code
expo start

# Scan with Expo Go app
# https://expo.dev/client
```

---

## EAS Build Setup

### Step 1: Create Expo Account
```bash
# Sign up
expo register

# Or sign in
expo login
```

### Step 2: Configure eas.json

**eas.json:**
```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "buildType": "simulator"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle",
        "gradleCommand": ":app:bundleRelease"
      },
      "ios": {
        "buildType": "archive"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "certificateSource": "local"
      },
      "android": {
        "serviceAccount": "./firebase-key.json"
      }
    }
  }
}
```

### Step 3: Set App Credentials

**iOS Certificate:**
```bash
# Generate or upload
eas credentials configure --platform ios

# Options:
# 1. Let EAS create and manage certificates
# 2. Upload existing certificates
# 3. Use managed credentials
```

**Android Keystore:**
```bash
# Generate or upload
eas credentials configure --platform android

# Use Firebase service account key
# Stored in firebase-key.json
```

### Step 4: Configure app.json

**app.json:**
```json
{
  "expo": {
    "name": "HPMS",
    "slug": "hpms",
    "version": "1.0.0",
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTabletMode": true,
      "bundleIdentifier": "dev.hpms.app"
    },
    "android": {
      "package": "dev.hpms.app",
      "versionCode": 1
    },
    "web": {
      "bundler": "metro"
    }
  },
  "eas": {
    "projectId": "[your-project-id]"
  }
}
```

---

## Production Build & Submit

### Step 1: Create Build

**Build for both platforms:**
```bash
# Interactive build
eas build --platform all

# Or specific platform
eas build --platform ios
eas build --platform android

# With auto-submit to stores
eas build --platform all --auto-submit
```

**Build options:**
- `--local` — Build on local machine
- `--wait` — Wait for build completion
- `--auto-submit` — Submit to stores after build
- `--release-channel production` — For OTA updates

### Step 2: Monitor Build

```bash
# List builds
eas build:list

# View specific build
eas build:view <build_id>

# Watch build progress
eas build:log <build_id>
```

### Step 3: Submit to App Stores

**Manual submission:**
```bash
# After build completes
eas submit --platform ios
eas submit --platform android
```

**Or auto-submit during build:**
```bash
eas build --platform all --auto-submit
```

**iOS App Store:**
- Requires Apple Developer account ($99/year)
- Manual review by Apple (24-48 hours)
- Certificate required: iOS Distribution

**Android Google Play:**
- Requires Google Play Developer account ($25 one-time)
- Automatic publishing after review (~2 hours)
- Keystore required

### Step 4: Monitor Submission

```bash
# View submission status
eas submit:list

# View submission details
eas submit:view <submission_id>

# Track store reviews
# Apple: App Store Connect
# Google: Google Play Console
```

---

## App Store Configuration

### Apple App Store Connect

1. **Create App:**
   - App Store Connect → My Apps → Create New App
   - App Name: HPMS
   - Bundle ID: dev.hpms.app
   - SKU: HPMS-001

2. **Configure:**
   - Add screenshots (all device sizes)
   - Write description and keywords
   - Set pricing
   - Configure ratings
   - Add privacy policy

3. **TestFlight:**
   ```bash
   # Build with --release-channel testflight
   eas build --platform ios --release-channel testflight
   
   # TestFlight testers receive invitation
   # Test for ~2 weeks before App Store submission
   ```

4. **Submit for Review:**
   - Compliance info
   - Advertising ID usage
   - Category selection
   - Contact information

### Google Play Console

1. **Create App:**
   - Google Play Console → Create New App
   - App Name: HPMS
   - Package Name: dev.hpms.app

2. **Configure:**
   - Add graphics (icon, screenshots, banners)
   - Write description and short description
   - Set pricing and distribution
   - Add privacy policy

3. **Set Up Testing:**
   ```bash
   # Internal testing track
   eas submit --platform android --track internal
   
   # Closed beta
   eas submit --platform android --track beta
   
   # Production
   eas submit --platform android --track production
   ```

4. **Staged Rollout:**
   - Start with 5% of users
   - Monitor crash rate and reviews
   - Gradually increase to 100%

---

## Over-the-Air Updates

### EAS Updates

**For JavaScript-only changes:**
```bash
# Publish update to production channel
eas update --channel production

# Users receive update within 1 hour
# No app store review needed

# View update history
eas update:list
```

**Update strategy:**
- Hotfixes: Deploy via EAS
- New features: Full app store build
- Configuration changes: EAS updates

### Configuration

**eas.json:**
```json
{
  "updates": {
    "url": "https://u.expo.dev/[project-id]"
  }
}
```

**app.json:**
```json
{
  "expo": {
    "updates": {
      "enabled": true,
      "checkAutomatically": "ON_APP_RESUME"
    }
  }
}
```

---

## Release Process

### Versioning

**Version format:** MAJOR.MINOR.PATCH

**Update before each release:**
```bash
# In package.json and app.json
{
  "version": "1.2.3",
  "expo": {
    "version": "1.2.3"
  }
}

# Android version code (must increment)
# Each build: version code += 1
```

### Release Checklist

```markdown
## Release Checklist v1.2.0

### Code
- [ ] All tests passing
- [ ] Code review approved
- [ ] No console errors
- [ ] TypeScript strict mode
- [ ] Performance optimized

### Testing
- [ ] iOS simulator tested
- [ ] Android emulator tested
- [ ] Physical device tested
- [ ] Dark mode verified
- [ ] Offline mode tested

### Configuration
- [ ] Version numbers updated
- [ ] Environment variables set
- [ ] API endpoints correct
- [ ] Analytics configured
- [ ] Error tracking enabled

### Pre-Release
- [ ] Create git tag: v1.2.0
- [ ] Start test flight build
- [ ] Internal testing passed
- [ ] Beta feedback reviewed

### Release
- [ ] Submit to app stores
- [ ] Monitor store reviews
- [ ] Watch error rates
- [ ] Check performance metrics
- [ ] Announce in changelog

### Post-Release
- [ ] Monitor crash reports
- [ ] Respond to reviews
- [ ] Watch adoption rate
- [ ] Plan next release
```

---

## Monitoring & Analytics

### Firebase Analytics

**Track events:**
```typescript
import { analytics } from '@react-native-firebase/analytics';

const onEvent = async () => {
  await analytics().logEvent('feature_map_opened', {
    screen_name: 'feature_map'
  });
};
```

**Monitor:**
- User engagement
- Feature adoption
- Session duration
- Retention metrics

### Crash Reporting

**Sentry integration:**
```typescript
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_ENV
});
```

**Monitor:**
- Crash reports
- Error frequency
- Affected user count
- Stack traces

### Performance Monitoring

**Firebase Performance:**
```typescript
import { perf } from '@react-native-firebase/perf';

const trace = await perf().startTrace('api_call');
// ... api operation
await trace.stop();
```

---

## Common Issues & Solutions

### Build Fails

```bash
# Clear cache
eas build --platform android --clear-cache

# Check credentials
eas credentials configure

# Verify Node version
node --version  # Should be 18+

# Check dependencies
npm install
```

### Certificate Issues (iOS)

```bash
# Reset certificates
eas credentials configure --platform ios

# View certificate status
eas credentials show --platform ios

# Revoke and regenerate
eas credentials configure --platform ios --clear
```

### Keystore Issues (Android)

```bash
# Reset keystore
eas credentials configure --platform android

# Regenerate from scratch
eas credentials configure --platform android --clear

# View keystore info
eas credentials show --platform android
```

### App Store Rejection

**Common reasons:**
- Incomplete app description
- Missing privacy policy
- Crashes on startup
- Inadequate app functionality
- Misleading metadata

**Solution:**
- Review Apple App Review Guidelines
- Fix reported issues
- Resubmit with detailed notes

---

## Deployment Checklist

### Pre-Build
- [ ] All tests pass: `npm test`
- [ ] Build locally successful: `npm run build`
- [ ] No TypeScript errors
- [ ] Git tag created
- [ ] Version numbers updated

### Build
- [ ] EAS build successful
- [ ] TestFlight build working (iOS)
- [ ] Internal test working (Android)
- [ ] All device sizes tested

### Submission
- [ ] App Store listing complete
- [ ] Play Store listing complete
- [ ] Screenshots added
- [ ] Privacy policy updated
- [ ] Release notes prepared

### Release
- [ ] App Store submission approved
- [ ] Play Store live
- [ ] Version tag on GitHub
- [ ] Release notes published
- [ ] Announcement sent

### Post-Release
- [ ] Monitor crash rate
- [ ] Watch user reviews
- [ ] Track adoption rate
- [ ] Plan next version

---

## Support & Resources

- **EAS Documentation:** https://docs.expo.dev/eas
- **App Store Review:** https://developer.apple.com/app-store/review/guidelines
- **Play Store Policies:** https://play.google.com/console/about/policies
- **Firebase Console:** https://console.firebase.google.com
- **Support Email:** support@hpms.dev
