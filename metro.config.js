// Expo's default Metro config, plus ONE opt-in alias for the web demo preview.
//
// With EXPO_PUBLIC_DEMO_DATA=1 and platform web, any import that resolves to
// lib/supabase.ts is redirected to demo/fakeSupabase.ts, so today's screens can
// be shown on fake data without signing in. With the flag unset (builds, EAS,
// normal dev) this file leaves the default config untouched: no alias at all.
// Never set the flag in eas.json, app.json or .env. See demo/README.md.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (process.env.EXPO_PUBLIC_DEMO_DATA === '1') {
  const realSupabase = path.resolve(__dirname, 'lib', 'supabase.ts');
  const fakeSupabase = path.resolve(__dirname, 'demo', 'fakeSupabase.ts');
  const upstream = config.resolver.resolveRequest;

  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolution = upstream
      ? upstream(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
    if (
      platform === 'web' &&
      resolution &&
      resolution.type === 'sourceFile' &&
      path.resolve(resolution.filePath) === realSupabase
    ) {
      return { ...resolution, filePath: fakeSupabase };
    }
    return resolution;
  };
}

module.exports = config;
