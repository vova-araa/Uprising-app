import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Reverse-domain bundle identifier for the App Store / Play Store.
  // NOTE: if you already registered the old Lovable id in TestFlight/Play,
  // keep that one instead — the id can't change after first submission.
  appId: 'nl.uprisingstudio.app',
  appName: 'Uprising Studio',
  // Ensure correct name syncs to Xcode
  webDir: 'dist',
  // For development/testing only — uncomment to live-reload from Lovable preview:
  // server: {
  //   url: 'https://79688009-b32b-472c-8549-ae9a329bdaaa.lovableproject.com?forceHideBadge=true',
  //   cleartext: true,
  // },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#08070d',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#08070d',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    scheme: 'uprising',
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#08070d',
  },
};

export default config;
