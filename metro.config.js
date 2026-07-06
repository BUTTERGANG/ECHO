// Metro configuration for ECHO.
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle's expo migrator imports generated `.sql` files as modules; Metro
// must treat `.sql` as a source extension to resolve them.
config.resolver.sourceExts.push('sql');

module.exports = config;
