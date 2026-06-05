// Dynamic Expo config layered over app.json.
//
// Why this exists: app.json statically points android.googleServicesFile at
// ./google-services.json, but that file is gitignored (it must stay out of this
// PUBLIC repo). EAS Build can't see it from the git archive, so it provides the
// file through a file-type env var, GOOGLE_SERVICES_JSON, written to a path
// OUTSIDE the project — which a static app.json can't reference. This thin layer
// spreads app.json unchanged and only swaps in the env-var path when EAS sets
// it; locally (env unset) it falls back to app.json's ./google-services.json.
export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
