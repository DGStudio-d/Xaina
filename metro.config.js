const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Treat .bundle files in assets/ as raw assets (not JS modules to parse)
config.resolver.assetExts.push("bundle");

module.exports = config;
