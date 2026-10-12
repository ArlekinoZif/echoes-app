// Cloudflare D1 REST API client (server-side only)
// Falls back to mock if CF_D1_DATABASE_ID not set (local dev without D1)

const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID ?? "";
const CF_D1_DATABASE_ID = process.env.CF_D1_DATABASE_ID ?? "";
const CF_D1_API_TOKEN = process.env.CF_D1_API_TOKEN ?? "";

const D1_AVAILABLE = !!(CF_ACCOUNT_ID && CF_D1_DATABASE_ID && CF_D1_API_TOKEN);

interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  errors: { message: string }[];
}

export async function d1Query(
  sql: string,
  params: (string | number | null | boolean)[] = []
): Promise<Record<string, unknown>[]> {
  if (!D1_AVAILABLE) {
    throw new Error("D1 not configured. Set CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_D1_API_TOKEN in .env");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_D1_DATABASE_ID}/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_D1_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });

  const json = (await res.json()) as { result: D1Result[]; success: boolean; errors: { message: string }[] };

  if (!json.success || json.errors?.length) {
    throw new Error(`D1 error: ${json.errors?.[0]?.message ?? "unknown"}`);
  }

  return json.result?.[0]?.results ?? [];
}

export async function d1Exec(
  sql: string,
  params: (string | number | null | boolean)[] = []
): Promise<void> {
  await d1Query(sql, params);
}

export { D1_AVAILABLE };
