import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.79688009b32b472c8549ae9a329bdaaa',
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
      backgroundColor: '#0f0f14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f0f14',
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
    backgroundColor: '#0f0f14',
  },
};

export default config;
