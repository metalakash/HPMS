/**
 * Detox Configuration for E2E Testing
 */

module.exports = {
  testRunner: 'jest',
  runnerArgs: ['--testNamePattern=.*', '--detectOpenHandles'],
  configurations: {
    ios: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14',
        os: 'iOS',
      },
      app: 'ios.release',
    },
    android: {
      type: 'android.emu',
      device: {
        avdName: 'Pixel_4_API_30',
      },
      app: 'android.release',
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Release-iphonesimulator/HPMSMobile.app',
      build:
        'xcodebuild -workspace ios/HPMSMobile.xcworkspace -scheme HPMSMobile -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath:
        'ios/build/Build/Products/Release-iphonesimulator/HPMSMobile.app',
      build:
        'xcodebuild -workspace ios/HPMSMobile.xcworkspace -scheme HPMSMobile -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build:
        'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build:
        'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  testRunner: 'jest',
};
