import { useAdminRole } from "@/hooks/useAdminRole";
import { Navigate } from "react-router-dom";
import PageLoader from "@/components/PageLoader";

/**
 * Route guard that prevents non-admin users from even loading admin page bundles.
 * Renders a loading spinner while checking, then redirects non-admins to home.
 */
const RequireAdmin = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useAdminRole();

  if (loading) {
    return <PageLoader />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default RequireAdmin;
