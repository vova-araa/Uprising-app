import { useState, useRef, useCallback, useEffect } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  scrollableRef?: React.RefObject<HTMLElement>;
}

export function usePullToRefresh({ onRefresh, threshold = 80, maxPull = 130, scrollableRef }: UsePullToRefreshOptions) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const getScrollTop = useCallback(() => {
    if (scrollableRef?.current) return scrollableRef.current.scrollTop;
    return window.scrollY;
  }, [scrollableRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (getScrollTop() <= 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, [isRefreshing, getScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || isRefreshing) return;
    const deltaY = e.touches[0].clientY - startY.current;
    if (deltaY > 0 && getScrollTop() <= 0) {
      const distance = Math.min(deltaY * 0.5, maxPull);
      setPullDistance(distance);
      if (distance > 10) e.preventDefault();
    } else {
      pulling.current = false;
      setPullDistance(0);
    }
  }, [isRefreshing, maxPull, getScrollTop]);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold * 0.6);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const el = scrollableRef?.current || containerRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, scrollableRef]);

  const progress = Math.min(pullDistance / threshold, 1);

  return { containerRef, pullDistance, isRefreshing, progress };
}
