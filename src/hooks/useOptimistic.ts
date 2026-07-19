import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook for optimistic UI updates.
 * Immediately applies the mutation to the cache, rolls back on error.
 *
 * Usage:
 *   const { optimisticUpdate } = useOptimistic();
 *   await optimisticUpdate({
 *     queryKey: ["sessions"],
 *     mutationFn: () => supabase.from("org_sessions").update(...),
 *     updater: (old) => old.map(s => s.id === id ? { ...s, status: "completed" } : s),
 *   });
 */
export function useOptimistic() {
  const queryClient = useQueryClient();
  const rollbackRef = useRef<(() => void) | null>(null);

  const optimisticUpdate = useCallback(async <T>({
    queryKey,
    mutationFn,
    updater,
    onSuccess,
    onError,
  }: {
    queryKey: string[];
    mutationFn: () => Promise<any>;
    updater: (old: T) => T;
    onSuccess?: () => void;
    onError?: (err: any) => void;
  }) => {
    // Snapshot previous state
    const previous = queryClient.getQueryData<T>(queryKey);

    // Optimistically update cache
    queryClient.setQueryData<T>(queryKey, (old) => {
      if (!old) return old as T;
      return updater(old);
    });

    // Set rollback
    rollbackRef.current = () => {
      queryClient.setQueryData(queryKey, previous);
    };

    try {
      const result = await mutationFn();
      onSuccess?.();
      return result;
    } catch (err) {
      // Rollback on error
      rollbackRef.current?.();
      onError?.(err);
      throw err;
    }
  }, [queryClient]);

  return { optimisticUpdate };
}
