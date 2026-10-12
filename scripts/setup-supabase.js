// Applies the canonical Supabase schema in migrations/supabase_setup.sql.
//
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/setup-supabase.js
//
// Credentials are read from the environment only. Never hardcode a
// service-role key: it bypasses row level security.

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment."
  );
  process.exit(1);
}

const SQL_PATH = path.join(__dirname, "..", "migrations", "supabase_setup.sql");
const SQL = fs.readFileSync(SQL_PATH, "utf8");

if (/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(SQL)) {
  console.error(
    `${SQL_PATH} disables row level security. Refusing to apply it.`
  );
  process.exit(1);
}

async function run() {
  const host = new URL(SUPABASE_URL).host;
  console.log("Applying", path.relative(process.cwd(), SQL_PATH), "to", host);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: SQL }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error(`exec_sql failed (HTTP ${res.status}): ${detail.slice(0, 500)}`);
    console.error(
      "\nRun the SQL manually in the Supabase dashboard SQL editor instead:\n" +
        `  ${SQL_PATH}`
    );
    process.exit(1);
  }

  console.log("Schema applied.");
}

run().catch((error) => {
  console.error(error);
  console.error(
    `\nRun the SQL manually in the Supabase dashboard SQL editor instead:\n  ${SQL_PATH}`
  );
  process.exit(1);
});
