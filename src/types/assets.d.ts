/** Metro bundles SVG files as assets (expo/metro-config assetExts); expo-image renders them. */
declare module '*.svg' {
  const asset: number;
  export default asset;
}
