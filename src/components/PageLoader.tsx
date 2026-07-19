import { Loader2 } from "lucide-react";

/** Full-page centered loading spinner — stretches to fill the available space */
const PageLoader = ({ size = 24 }: { size?: number }) => (
  <div className="flex-1 flex items-center justify-center min-h-[40vh]">
    <Loader2 size={size} className="animate-spin text-primary" />
  </div>
);

export default PageLoader;
