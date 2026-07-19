import { lazy, Suspense, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

import { I18nProvider } from "@/lib/i18n";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppConfigProvider } from "@/contexts/AppConfigContext";
import AppShell from "@/components/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import PageTransition from "@/components/PageTransition";
import { prefetchCorePages } from "@/lib/prefetch";

const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));
const OfflineBanner = lazy(() => import("@/components/OfflineBanner"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const HomePage = lazy(() => import("./pages/HomePage"));

// Lazy-loaded pages
const BookingPage = lazy(() => import("./pages/BookingPage"));
const SpacesPage = lazy(() => import("./pages/SpacesPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const DienstenPage = lazy(() => import("./pages/DienstenPage"));
const MembershipsDetailPage = lazy(() => import("./pages/service/MembershipsDetailPage"));
const BroedplaatsDetailPage = lazy(() => import("./pages/service/BroedplaatsDetailPage"));
const StudioSessionDetailPage = lazy(() => import("./pages/service/StudioSessionDetailPage"));
const ProducerSessionDetailPage = lazy(() => import("./pages/service/ProducerSessionDetailPage"));
const ContentDetailPage = lazy(() => import("./pages/service/ContentDetailPage"));
const DrukkerijDetailPage = lazy(() => import("./pages/service/DrukkerijDetailPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const MixMasterPage = lazy(() => import("./pages/MixMasterPage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const AIAssistantPage = lazy(() => import("./pages/AIAssistantPage"));
const ContentCoachPage = lazy(() => import("./pages/ContentCoachPage"));
const LabelDashboardPage = lazy(() => import("./pages/LabelDashboardPage"));
const CollabBoardPage = lazy(() => import("./pages/CollabBoardPage"));
const RequestPage = lazy(() => import("./pages/RequestPage"));
const ProducerBookingPage = lazy(() => import("./pages/ProducerBookingPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const FeedbackPage = lazy(() => import("./pages/FeedbackPage"));
const AdminCalendarPage = lazy(() => import("./pages/AdminCalendarPage"));
const OrgDashboardPage = lazy(() => import("./pages/OrgDashboardPage"));
const AdminTasksPage = lazy(() => import("./pages/AdminTasksPage"));
const AdminFacilitiesPage = lazy(() => import("./pages/AdminFacilitiesPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Admin pages — completely separate bundle, only loaded for admins
const AdminPage = lazy(() => import("./pages/AdminPage"));
const RequireAdmin = lazy(() => import("./components/RequireAdmin"));

// Prefetch handled by lib/prefetch.ts

const PageLoader = () => (
  <div className="flex items-center justify-center" style={{ minHeight: "100dvh" }}>
    <img src="/uprising-logo.png" alt="Uprising Studio" className="w-16 h-16 rounded-2xl animate-pulse" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
    },
    mutations: {
      retry: 1,
    },
  },
});

/** Wrapper that requires authentication — redirects to /auth if not logged in */
const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <img src="/uprising-logo.png" alt="Uprising Studio" className="w-16 h-16 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (!user) return <AuthPage embedded />;

  return <>{children}</>;
};

const AppRoutes = () => {
  const location = useLocation();

  useEffect(() => {
    prefetchCorePages();
  }, []);

  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <PageTransition>
          <Routes location={location}>
            {/* Public routes — freely browsable */}
            <Route path="/" element={<HomePage />} />
            <Route path="/spaces" element={<SpacesPage />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/services" element={<ServicesPage />} />
            <Route path="/diensten" element={<DienstenPage />} />
            <Route path="/diensten/memberships" element={<MembershipsDetailPage />} />
            <Route path="/diensten/broedplaats" element={<BroedplaatsDetailPage />} />
            <Route path="/diensten/studio-session" element={<StudioSessionDetailPage />} />
            <Route path="/diensten/producer-session" element={<ProducerSessionDetailPage />} />
            <Route path="/diensten/content" element={<ContentDetailPage />} />
            <Route path="/diensten/drukkerij" element={<DrukkerijDetailPage />} />
            <Route path="/mix-master" element={<MixMasterPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/auth" element={<AuthPage />} />

            {/* Auth-required routes */}
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
            <Route path="/projects" element={<RequireAuth><Navigate to="/account?tab=projects" replace /></RequireAuth>} />
            <Route path="/ai-assistant" element={<RequireAuth><AIAssistantPage /></RequireAuth>} />
            <Route path="/coach" element={<RequireAuth><ContentCoachPage /></RequireAuth>} />
            <Route path="/label" element={<RequireAuth><LabelDashboardPage /></RequireAuth>} />
            <Route path="/collab" element={<RequireAuth><CollabBoardPage /></RequireAuth>} />
            <Route path="/request" element={<RequestPage />} />
            <Route path="/producer-booking" element={<ProducerBookingPage />} />
            <Route path="/feedback/:bookingId" element={<RequireAuth><FeedbackPage /></RequireAuth>} />
            
            {/* Admin-only routes — bundle is NOT loaded for regular users */}
            <Route path="/admin" element={
              <RequireAuth>
                <Suspense fallback={<PageLoader />}>
                  <RequireAdmin><AdminPage /></RequireAdmin>
                </Suspense>
              </RequireAuth>
            } />
            <Route path="/planning" element={
              <RequireAuth>
                <Suspense fallback={<PageLoader />}>
                  <RequireAdmin><AdminCalendarPage /></RequireAdmin>
                </Suspense>
              </RequireAuth>
            } />
            <Route path="/org" element={
              <RequireAuth>
                <Suspense fallback={<PageLoader />}>
                  <RequireAdmin><OrgDashboardPage /></RequireAdmin>
                </Suspense>
              </RequireAuth>
            } />
            <Route path="/admin-taken" element={
              <RequireAuth>
                <Suspense fallback={<PageLoader />}>
                  <RequireAdmin><AdminTasksPage /></RequireAdmin>
                </Suspense>
              </RequireAuth>
            } />
            <Route path="/admin-faciliteiten" element={
              <RequireAuth>
                <Suspense fallback={<PageLoader />}>
                  <RequireAdmin><AdminFacilitiesPage /></RequireAdmin>
                </Suspense>
              </RequireAuth>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </PageTransition>
      </Suspense>
    </AppShell>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppConfigProvider>
          <Suspense fallback={null}>
            <TooltipProvider>
              <Toaster />
              <OfflineBanner />
              
              <HashRouter>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/*" element={<AppRoutes />} />
                  </Routes>
                </Suspense>
              </HashRouter>
            </TooltipProvider>
          </Suspense>
          </AppConfigProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
