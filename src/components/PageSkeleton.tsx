import { motion } from "framer-motion";

const Pulse = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-secondary ${className}`} />
);

/** Generic page skeleton with header + cards pattern */
export const PageSkeleton = () => (
  <div className="px-5 py-8 space-y-5">
    <Pulse className="h-8 w-48" />
    <Pulse className="h-4 w-64" />
    <div className="space-y-3 mt-6">
      <Pulse className="h-24 w-full" />
      <Pulse className="h-24 w-full" />
      <Pulse className="h-24 w-full" />
    </div>
  </div>
);

/** Card-style skeleton for lists */
export const CardSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Pulse className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-3 w-48" />
          </div>
        </div>
        <Pulse className="h-3 w-full" />
      </div>
    ))}
  </div>
);

/** Dashboard stats skeleton */
export const StatsSkeleton = () => (
  <div className="grid grid-cols-2 gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-border p-4 space-y-2">
        <Pulse className="h-3 w-16" />
        <Pulse className="h-8 w-20" />
      </div>
    ))}
  </div>
);

export default PageSkeleton;
