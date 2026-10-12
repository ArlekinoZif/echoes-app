/**
 * Reads an environment variable at runtime.
 *
 * Next.js statically replaces every literal `process.env.NEXT_PUBLIC_X` — in
 * server bundles too — with the value present when the bundle was built. A build
 * made on a developer machine therefore carries that machine's Supabase project,
 * RPC endpoint and pool settings into production, where they are wrong.
 *
 * Indexing `process.env` dynamically defeats that substitution, so the deployed
 * environment wins on the server. On the client `process.env` only holds the
 * inlined values, so callers pass the literal read as a fallback.
 */
export function runtimeEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env[name];
  return value === "" ? undefined : value;
}
