/**
 * Provider Configuration — Config-driven Dependency Injection
 *
 * Reads environment flags to determine which providers are active.
 * OPhim/KKPhim: opt-out (enabled by default, set to 'false' to disable)
 * NguonC: opt-in (disabled by default, set to 'true' to enable)
 *
 * Exports a singleton MovieSourceManager with all active providers.
 */

const MovieSourceManager = require("../services/MovieSourceManager");

// Import provider singletons
const ophimProvider = require("../services/ophimApi");
const kkphimProvider = require("../services/kkphimApi");
const nguoncProvider = require("../services/nguoncApi");

const enabledProviders = [
  process.env.ENABLE_OPHIM !== "false" && ophimProvider,
  process.env.ENABLE_KKPHIM !== "false" && kkphimProvider,
].filter(Boolean);

// Thêm các Plugin Động (HH3D, MissAV, v.v.)
const PluginProvider = require("../services/PluginProvider");
const pluginsConfig = [
    {
        "id": "hh3d",
        "name": "HH3D - Hoạt Hình 3D",
        "version": "2.0.0",
        "scriptUrl": "plugins/hh3d_rule.json",
        "iconUrl": "https://raw.githubusercontent.com/youngbi/repo/main/plugins/hh3d.ico",
        "isStreamingOnly": false
    },
    /*
    {
        "id": "missav",
        "name": "MissAV",
        "scriptUrl": "https://raw.githubusercontent.com/youngbi/repo/main/plugins/missav_plugin.js"
    },
    {
        "id": "javhd",
        "name": "JavHD",
        "scriptUrl": "https://raw.githubusercontent.com/youngbi/repo/main/plugins/javhd_plugin.js"
    },
    */
];

if (process.env.ENABLE_NGUONC === "true") {
    pluginsConfig.push({
        "id": "nguonc",
        "name": "Phim NguonC",
        "version": "1.0.8",
        "scriptUrl": "https://raw.githubusercontent.com/youngbi/repo/main/plugins/nguonc_plugin.js",
        "iconUrl": "https://raw.githubusercontent.com/youngbi/repo/main/plugins/nguonC.png",
        "isStreamingOnly": false
    });
}

for (const p of pluginsConfig) {
  enabledProviders.push(new PluginProvider(p));
}

// Failsafe: if all providers are somehow disabled, use OPhim
if (enabledProviders.length === 0) {
  enabledProviders.push(ophimProvider);
}

const sourceManager = new MovieSourceManager(enabledProviders);

module.exports = { sourceManager, enabledProviders };
