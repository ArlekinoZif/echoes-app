// Moves legacy story audio out of the public Supabase Storage bucket into the
// private R2 bucket and rewrites each story's audio_url to the authenticated
// /api/audio/... proxy path.
//
// Dry run (default, writes nothing):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET_NAME=... \
//     node scripts/migrate-legacy-audio.js
//
// Apply:                node scripts/migrate-legacy-audio.js --apply
// Private stories only: node scripts/migrate-legacy-audio.js --apply --private-only
//
// The script never deletes the source object. Delete the legacy public bucket
// contents manually only after verifying playback through the proxy.

const { createClient } = require("@supabase/supabase-js");
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

const APPLY = process.argv.includes("--apply");
const PRIVATE_ONLY = process.argv.includes("--private-only");

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

const AUDIO_TYPES = new Set([
  "audio/webm",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);

function objectKeyFor(story, sourceUrl) {
  // Mirrors src/app/api/upload/route.ts so the proxy's owner check still holds.
  const owner = story.owner_id || story.author_wallet || "legacy";
  const ownerKey = Buffer.from(String(owner)).toString("base64url");
  const name = decodeURIComponent(new URL(sourceUrl).pathname.split("/").pop() || "audio.webm");
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const stamp = story.created_at ? new Date(story.created_at).getTime() : Date.now();
  return `stories/${ownerKey}/${stamp}-${safeName}`;
}

async function alreadyInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function migrateStory(story) {
  const sourceUrl = story.audio_url;
  const key = objectKeyFor(story, sourceUrl);
  const proxyUrl = `/api/audio/${key}`;

  if (!APPLY) {
    console.log(`[dry-run] ${story.id}: ${sourceUrl} -> ${proxyUrl}`);
    return "planned";
  }

  if (!(await alreadyInR2(key))) {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.error(`  ${story.id}: source fetch failed (HTTP ${res.status})`);
      return "failed";
    }
    const contentType = res.headers.get("content-type") || "audio/webm";
    if (!AUDIO_TYPES.has(contentType.split(";")[0].trim())) {
      console.error(`  ${story.id}: unexpected content type ${contentType}`);
      return "failed";
    }
    const body = Buffer.from(await res.arrayBuffer());
    if (body.byteLength === 0) {
      console.error(`  ${story.id}: source object is empty`);
      return "failed";
    }
    await r2.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "private, no-store",
      })
    );
    console.log(`  ${story.id}: copied ${body.byteLength} bytes to ${key}`);
  } else {
    console.log(`  ${story.id}: ${key} already present in R2`);
  }

  const { error } = await supabase
    .from("stories")
    .update({ audio_url: proxyUrl })
    .eq("id", story.id);
  if (error) {
    console.error(`  ${story.id}: audio_url update failed: ${error.message}`);
    return "failed";
  }
  console.log(`  ${story.id}: audio_url -> ${proxyUrl}`);
  return "migrated";
}

async function run() {
  let query = supabase
    .from("stories")
    .select("id, audio_url, owner_id, author_wallet, created_at, is_private")
    .not("audio_url", "like", "/api/audio/%");
  if (PRIVATE_ONLY) query = query.eq("is_private", true);

  const { data, error } = await query;
  if (error) throw new Error(`Story query failed: ${error.message}`);

  const candidates = (data || []).filter(
    (s) => typeof s.audio_url === "string" && /^https?:\/\//.test(s.audio_url)
  );
  const skipped = (data || []).length - candidates.length;

  console.log(
    `${candidates.length} story rows to migrate` +
      (skipped ? ` (${skipped} skipped: audio_url is not an absolute URL)` : "") +
      (APPLY ? "" : " — dry run, pass --apply to write")
  );

  const counts = { planned: 0, migrated: 0, failed: 0 };
  for (const story of candidates) {
    counts[await migrateStory(story)] += 1;
  }

  console.log(
    `Done. planned=${counts.planned} migrated=${counts.migrated} failed=${counts.failed}`
  );
  if (counts.failed) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
