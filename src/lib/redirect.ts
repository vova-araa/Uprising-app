/**
 * Redirect to an external URL (e.g. Stripe Checkout).
 *
 * iOS Safari/WebKit aggressively blocks `window.open(...)` calls that happen
 * AFTER an async boundary (e.g. after `await fetch(...)`). The original user
 * gesture is considered "consumed" and the popup is silently killed.
 *
 * For Stripe Checkout the only reliable cross-platform approach is a
 * top-level navigation in the same window: `window.location.href = url`.
 * This preserves history, works inside the Lovable iframe (top-frame nav),
 * and never triggers the iOS popup blocker.
 */
export const redirectToExternal = (url: string) => {
  try {
    // If we're embedded (e.g. Lovable preview iframe), break out to the top.
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    // Cross-origin frame access blocked — fall through to same-window nav.
  }

  // Same-window navigation. This is the WebKit-safe path.
  window.location.href = url;
};
