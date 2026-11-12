const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)

// Our shared packages are TypeScript written for Node/Bun, where an import of
// "./units.js" means the file "./units.ts". Metro does not know that, so retry
// a relative ".js" import without the extension.
const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = resolveRequest ?? context.resolveRequest
  if (moduleName.startsWith(".") && moduleName.endsWith(".js")) {
    try {
      return resolve(context, moduleName.slice(0, -3), platform)
    } catch {
      // Fall through: it may be a real .js file.
    }
  }
  return resolve(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: "./global.css" })
