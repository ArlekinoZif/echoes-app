// Browser stub: replaces Node-only modules that @solana/web3.js imports
// but are never called in browser (it uses native fetch/WebSocket instead).
export default {};
export const Headers = typeof globalThis.Headers !== "undefined" ? globalThis.Headers : class {};
export const Request = typeof globalThis.Request !== "undefined" ? globalThis.Request : class {};
export const Response = typeof globalThis.Response !== "undefined" ? globalThis.Response : class {};
