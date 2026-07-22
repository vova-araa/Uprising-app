// Share helper: uses the native share sheet on mobile (Web Share API) and
// falls back to copying the link to the clipboard on desktop / unsupported
// browsers. Returns what happened so the caller can show the right feedback.

export type ShareResult = "shared" | "copied" | "failed";

export async function shareOrCopy(data: { title?: string; text?: string; url: string }): Promise<ShareResult> {
  // Web Share API (mobile / PWA) — opens the OS share sheet.
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      // AbortError = user dismissed the sheet; treat as a no-op, not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      // fall through to clipboard
    }
  }
  // Clipboard fallback (desktop).
  try {
    await navigator.clipboard.writeText(data.url);
    return "copied";
  } catch {
    return "failed";
  }
}
