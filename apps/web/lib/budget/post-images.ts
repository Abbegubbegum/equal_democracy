/**
 * The budget-post image library.
 *
 * A municipality's budget posts ("Kulturnämnden", "Skatteintäkter", …) come
 * back every year as a new BudgetSession built from that year's PDF. The
 * illustration belongs to the post *name*, so it is stored once in the
 * BudgetPostImage collection (file in Vercel Blob under budget-post-images/)
 * and copied onto every budget post with that name:
 *
 * - a new budget gets its images at creation (applyPostImages),
 * - replacing an image repoints every budget that showed the old one, and the
 *   old file is deleted only once nothing references it anymore (setPostImage).
 *
 * A post whose name isn't in the library simply has no image until an admin
 * uploads one.
 */

import { put, del } from "@vercel/blob";
import { BudgetPostImage, BudgetSession } from "../models";
import { compressImage } from "../image";

type Post = { name?: string; imageUrl?: string | null };
type SessionLike = { categories?: Post[]; incomeCategories?: Post[] };

/** The matching key for a post name: case, spacing and Unicode form ignored. */
export function postImageKey(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

function blobSlug(key: string): string {
  return key
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function postsOf(session: SessionLike): Post[] {
  return [...(session.categories ?? []), ...(session.incomeCategories ?? [])];
}

/** key → imageUrl for the whole library. */
export async function postImageMap(): Promise<Map<string, string>> {
  const rows = await BudgetPostImage.find().select("key imageUrl").lean();
  return new Map(rows.map((r: any) => [r.key, r.imageUrl]));
}

/**
 * Gives every post without an image the library image for its name. Mutates
 * the session's post arrays in place (works on a document or a plain object
 * about to be saved); returns how many posts got an image.
 */
export function applyPostImages(
  session: SessionLike,
  library: Map<string, string>,
): number {
  let applied = 0;
  for (const post of postsOf(session)) {
    if (post.imageUrl || !post.name) continue;
    const url = library.get(postImageKey(post.name));
    if (url) {
      post.imageUrl = url;
      applied++;
    }
  }
  return applied;
}

async function isReferenced(url: string): Promise<boolean> {
  const [inLibrary, inSession] = await Promise.all([
    BudgetPostImage.exists({ imageUrl: url }),
    BudgetSession.exists({
      $or: [
        { "categories.imageUrl": url },
        { "incomeCategories.imageUrl": url },
      ],
    }),
  ]);
  return !!inLibrary || !!inSession;
}

/**
 * Stores `raw` as the library image for `name` and puts it on every budget
 * post with that name, in every budget session. Previous files are deleted
 * once nothing points at them. Returns the new image URL.
 */
export async function setPostImage(
  name: string,
  raw: Buffer,
): Promise<{ imageUrl: string; sessionsUpdated: number }> {
  const key = postImageKey(name);
  const buffer = await compressImage(raw);

  // A fresh pathname per upload rather than overwriting one: Blob URLs are
  // CDN-cached, so an overwritten file could keep serving the old picture.
  const { url } = await put(
    `budget-post-images/${blobSlug(key) || "post"}-${Date.now()}.jpg`,
    buffer,
    { access: "public", contentType: "image/jpeg" },
  );

  const previous: any = await BudgetPostImage.findOne({ key }).lean();
  await BudgetPostImage.updateOne(
    { key },
    { $set: { name: name.trim(), imageUrl: url } },
    { upsert: true },
  );

  const replaced = new Set<string>();
  if (previous?.imageUrl) replaced.add(previous.imageUrl);

  // A handful of budget sessions exist (one per year and municipality), so
  // matching names in JS is cheaper than anything clever.
  const sessions = await BudgetSession.find();
  let sessionsUpdated = 0;
  for (const session of sessions) {
    let changed = false;
    for (const post of postsOf(session)) {
      if (!post.name || postImageKey(post.name) !== key) continue;
      if (post.imageUrl === url) continue;
      if (post.imageUrl) replaced.add(post.imageUrl);
      post.imageUrl = url;
      changed = true;
    }
    if (changed) {
      await session.save();
      sessionsUpdated++;
    }
  }

  for (const old of replaced) {
    if (old === url || !old.startsWith("http")) continue;
    if (!(await isReferenced(old))) await del(old).catch(() => {});
  }

  return { imageUrl: url, sessionsUpdated };
}
