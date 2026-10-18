// Font files imported as assets. Metro gives a module id (a number) on iOS and Android and a URL
// (a string) on the web; Vite and Vitest give a URL.
declare module '*.ttf' {
  const asset: number | string;
  export default asset;
}
declare module '*.otf' {
  const asset: number | string;
  export default asset;
}
declare module '*.woff2' {
  const asset: number | string;
  export default asset;
}
