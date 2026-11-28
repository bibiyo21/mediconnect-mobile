const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// pusher-js's React Native build requires @react-native-community/netinfo. The
// linked @mediconnect/api-client resolves pusher-js from its own pnpm store,
// which cannot see mobile/node_modules, so the package is mapped here.
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  '@react-native-community/netinfo': path.resolve(__dirname, 'node_modules/@react-native-community/netinfo'),
};

module.exports = config;
