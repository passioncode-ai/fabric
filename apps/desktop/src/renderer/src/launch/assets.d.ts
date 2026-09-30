// Vite resolves `?url` imports to the built asset's address.
declare module '*.svg?url' {
  const src: string
  export default src
}
