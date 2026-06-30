// Ambient declarations so `tsc` understands the web CSS imports that Metro
// resolves at bundle time (used by the Expo template's themed components).
declare module '*.css';

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
