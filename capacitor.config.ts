import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cnmbuckstudios.chainreaction',
  appName: 'Chain Reaction',
  webDir: 'dist',
  ios: { contentInset: 'never' },
  experimental: {
    ios: {
      spm: {
        swiftToolsVersion: '6.1',
        // Firebase Analytics without the advertising ID (IDFA): play analytics need no tracking.
        packageTraits: { '@capacitor-firebase/analytics': ['AnalyticsWithoutAdIdSupport'] },
      },
    },
  },
};

export default config;
