/**
 * Lightweight page prefetch system.
 * – Prefetches page chunks on hover/focus for instant navigation.
 * – Uses a Set to avoid duplicate imports.
 */

const prefetched = new Set<string>();

// Map of routes to their lazy import functions
const routeImports: Record<string, () => Promise<any>> = {
  "/": () => import("@/pages/HomePage"),
  "/book": () => import("@/pages/BookingPage"),
  "/spaces": () => import("@/pages/SpacesPage"),
  "/diensten": () => import("@/pages/DienstenPage"),
  "/services": () => import("@/pages/ServicesPage"),
  "/account": () => import("@/pages/AccountPage"),
  "/more": () => import("@/pages/MorePage"),
  "/mix-master": () => import("@/pages/MixMasterPage"),
  "/request": () => import("@/pages/RequestPage"),
  "/producer-booking": () => import("@/pages/ProducerBookingPage"),
  "/ai-assistant": () => import("@/pages/AIAssistantPage"),
  "/admin": () => import("@/pages/AdminPage"),
  "/planning": () => import("@/pages/AdminCalendarPage"),
  "/org": () => import("@/pages/OrgDashboardPage"),
  "/auth": () => import("@/pages/AuthPage"),
  "/diensten/memberships": () => import("@/pages/service/MembershipsDetailPage"),
  "/diensten/broedplaats": () => import("@/pages/service/BroedplaatsDetailPage"),
  "/diensten/studio-session": () => import("@/pages/service/StudioSessionDetailPage"),
  "/diensten/producer-session": () => import("@/pages/service/ProducerSessionDetailPage"),
  "/diensten/content": () => import("@/pages/service/ContentDetailPage"),
  "/diensten/drukkerij": () => import("@/pages/service/DrukkerijDetailPage"),
};

/** Prefetch a route's chunk. Safe to call multiple times. */
export const prefetchRoute = (path: string) => {
  if (prefetched.has(path)) return;
  const importFn = routeImports[path];
  if (importFn) {
    prefetched.add(path);
    importFn();
  }
};

/** Attach to onMouseEnter / onFocus on navigation elements */
export const prefetchOnHover = (path: string) => ({
  onMouseEnter: () => prefetchRoute(path),
  onFocus: () => prefetchRoute(path),
});

/** Prefetch core pages during idle time */
export const prefetchCorePages = () => {
  const idle = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 200);

  idle(() => {
    prefetchRoute("/book");
    prefetchRoute("/spaces");
    prefetchRoute("/diensten");
    prefetchRoute("/account");
    prefetchRoute("/more");
  });
};

/** Prefetch admin-only pages (called after admin role is confirmed) */
export const prefetchAdminPages = () => {
  const idle = typeof requestIdleCallback === "function"
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 400);

  idle(() => {
    prefetchRoute("/admin");
    prefetchRoute("/planning");
    prefetchRoute("/org");
  });
};

