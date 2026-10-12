import { Story } from "@/lib/types";
import { runtimeEnv } from "@/lib/runtime-env";

const UUID_SUFFIX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function siteUrl(): string {
  return (runtimeEnv("NEXT_PUBLIC_SITE_URL") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.echoes.fans").replace(/\/$/, "");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** `/recordings/<slug>-<id>` — the slug is decoration, the trailing id is the key. */
export function storyPath(story: Pick<Story, "id" | "title">): string {
  const slug = slugify(story.title ?? "");
  return `/recordings/${slug ? `${slug}-${story.id}` : story.id}`;
}

export function storyUrl(story: Pick<Story, "id" | "title">): string {
  return `${siteUrl()}${storyPath(story)}`;
}

/** Pulls the story id back out of a `<slug>-<id>` path segment. */
export function storyIdFromSlug(segment: string): string | null {
  const match = decodeURIComponent(segment).match(UUID_SUFFIX);
  return match ? match[0].toLowerCase() : null;
}

/** Only published stories have a public page. */
export function isPubliclyVisible(story: Story): boolean {
  return story.status === "listed" || story.status === "tokenized";
}
