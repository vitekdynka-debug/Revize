// Vite asset URL imports (resolved by the consuming app's bundler).
declare module '*?url' {
  const url: string;
  export default url;
}
