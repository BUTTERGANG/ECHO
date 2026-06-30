// babel-plugin-inline-import inlines Drizzle's generated `.sql` migration
// files as string literals so the expo migrator can run them at runtime.
// See: https://orm.drizzle.team/docs/get-started/expo-new
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
