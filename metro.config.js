// Metro configuration for ECHO.
// Web support for expo-sqlite (wa-sqlite) requires:
//   1. bundling .wasm assets
//   2. COOP/COEP response headers so the browser allows SharedArrayBuffer
//      (used by wa-sqlite's multi-threaded web build)
// See: https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Allow Metro to resolve and serve WebAssembly files.
config.resolver.assetExts.push('wasm');

// Drizzle's expo migrator imports generated `.sql` files as modules; Metro
// must treat `.sql` as a source extension to resolve them.
config.resolver.sourceExts.push('sql');

// Add the cross-origin isolation headers the dev server needs for
// SharedArrayBuffer. EAS/production hosting must set the same headers.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    middleware(req, res, next);
  };
};

module.exports = config;
