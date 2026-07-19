import React, { lazy, Suspense, useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { useLocation } from "react-router-dom";
import { InlineToastRenderer } from "./InlineToast";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useWebPush } from "@/hooks/useWebPush";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import BottomNav from "./BottomNav";
import DesktopNav from "./DesktopNav";
import { Loader2 } from "lucide-react";
const AIAssistantOverlay = lazy(() => import("./AIAssistantOverlay"));

// Context so HomePage can toggle AI overlay
interface AIOverlayContextType {
  showAI: boolean;
  setShowAI: React.Dispatch<React.SetStateAction<boolean>>;
}
const AIOverlayContext = createContext<AIOverlayContextType>({ showAI: false, setShowAI: () => {} });
export const useAIOverlay = () => useContext(AIOverlayContext);

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const [showAI, setShowAI] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const routesWithOwnSafeTop = new Set([
    "/",
    "/book",
    "/producer-booking",
    "/request",
    "/mix-master",
    "/admin",
    "/planning",
    "/org",
  ]);
  const mainPaddingTop = routesWithOwnSafeTop.has(location.pathname) ? "0px" : "var(--safe-area-top)";

  // Pull-to-refresh on all pages
  const handleRefresh = useCallback(async () => {
    // Small delay to feel responsive, then reload current page data
    await new Promise(resolve => setTimeout(resolve, 600));
    window.location.reload();
  }, []);

  const { pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    maxPull: 130,
    scrollableRef: mainRef as React.RefObject<HTMLElement>,
  });

  // Register for push notifications on native platforms
  usePushNotifications();
  // Auto-subscribe to web push on browsers (PWA / installed app)
  useWebPush();

  // Instant scroll to top on route change
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <AIOverlayContext.Provider value={{ showAI, setShowAI }}>
      <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden" style={{ backgroundColor: "hsl(var(--background))" }}>
        {/* Desktop top nav */}
        <DesktopNav />

        {/* Pull-to-refresh indicator */}
        <div
          className="absolute left-0 right-0 z-40 flex items-center justify-center pointer-events-none transition-all duration-200 lg:hidden"
          style={{
            top: pullDistance > 0 || isRefreshing ? `calc(var(--safe-area-top, 0px) + ${pullDistance - 40}px)` : "-40px",
            opacity: progress > 0.1 || isRefreshing ? 1 : 0,
          }}
        >
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-full bg-card border border-border shadow-lg transition-transform duration-200 ${isRefreshing ? "animate-spin" : ""}`}
            style={{
              transform: isRefreshing ? undefined : `rotate(${progress * 360}deg) scale(${0.6 + progress * 0.4})`,
            }}
          >
            <Loader2 size={20} className="text-primary" />
          </div>
        </div>

        <main
          ref={mainRef}
          className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden overscroll-none desktop-main"
          style={{
            paddingTop: mainPaddingTop,
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
            paddingBottom: "var(--bottom-nav-total-offset)",
            overscrollBehaviorY: "none",
            WebkitOverflowScrolling: "touch",
            backgroundColor: "hsl(var(--background))",
            transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
            transition: pullDistance > 0 ? "none" : "transform 0.3s ease-out",
          }}
        >
          <InlineToastRenderer />
          <div className="flex-1">
            {children}
          </div>
        </main>
        {user && <Suspense fallback={null}><AIAssistantOverlay open={showAI} onClose={() => setShowAI(false)} /></Suspense>}
        <BottomNav />
      </div>
    </AIOverlayContext.Provider>
  );
};

export default AppShell;
