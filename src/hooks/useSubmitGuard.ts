import { useState, useCallback, useRef } from "react";

/**
 * Prevents double-clicks on critical actions (pay, login, submit).
 * Returns [isSubmitting, guardedFn] where guardedFn wraps the async action.
 */
export function useSubmitGuard() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const lockRef = useRef(false);

  const guard = useCallback(<T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (lockRef.current) return Promise.resolve(undefined);
    lockRef.current = true;
    setIsSubmitting(true);

    return fn().finally(() => {
      lockRef.current = false;
      setIsSubmitting(false);
    });
  }, []);

  return { isSubmitting, guard } as const;
}
