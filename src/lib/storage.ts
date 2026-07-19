import { supabase } from "@/integrations/supabase/client";

const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Extract the storage path from a full public URL or return the path as-is.
 * Handles both legacy full URLs and new path-only values.
 */
function extractPath(bucket: string, urlOrPath: string): string {
  if (urlOrPath.startsWith("http")) {
    const marker = `/object/public/${bucket}/`;
    const idx = urlOrPath.indexOf(marker);
    if (idx !== -1) return urlOrPath.slice(idx + marker.length).split("?")[0];
  }
  return urlOrPath;
}

/**
 * Create a signed URL for a file in a private bucket.
 * Falls back to the original URL if signing fails.
 */
export async function getSignedUrl(bucket: string, urlOrPath: string): Promise<string> {
  const path = extractPath(bucket, urlOrPath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_EXPIRY);
  if (error || !data?.signedUrl) {
    console.warn("Failed to create signed URL:", error?.message);
    return urlOrPath;
  }
  return data.signedUrl;
}

/**
 * Resolve an array of file URLs/paths to signed URLs.
 */
export async function getSignedUrls(bucket: string, urlsOrPaths: string[]): Promise<string[]> {
  if (!urlsOrPaths.length) return [];
  const paths = urlsOrPaths.map(u => extractPath(bucket, u));
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(paths, SIGNED_URL_EXPIRY);
  if (error || !data) {
    console.warn("Failed to create signed URLs:", error?.message);
    return urlsOrPaths;
  }
  return data.map((d, i) => d.signedUrl || urlsOrPaths[i]);
}
