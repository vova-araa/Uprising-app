import { useLocation, useNavigate } from "react-router-dom";
import { Home, CalendarDays, MapPin, LayoutGrid, Shield, User, LogIn, Sparkles, Building2, ListTodo } from "lucide-react";
import uprisingLogo from "@/assets/uprising-logo.png";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import NotificationBell from "./NotificationBell";
import { prefetchRoute } from "@/lib/prefetch";

const DesktopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminRole();

  const navItems = [
    { path: "/", label: "Home", icon: Home },
    { path: "/diensten", label: lang === "nl" ? "Diensten" : "Services", icon: LayoutGrid },
    { path: "/book", label: lang === "nl" ? "Boeken" : "Book", icon: CalendarDays },
    { path: "/spaces", label: lang === "nl" ? "Ruimtes" : "Spaces", icon: MapPin },
  ];

  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  return (
    <header className="hidden lg:flex fixed top-0 left-0 right-0 z-50 h-16 items-center border-b border-border backdrop-blur-xl"
      style={{ backgroundColor: "hsl(var(--card) / 0.95)" }}>
      <div className="w-full flex items-center justify-between px-8">
        {/* Logo / Brand */}
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
          <img src={uprisingLogo} alt="Uprising Studio" className="h-9 w-9 rounded-lg object-contain" />
          <span className="text-lg font-bold font-display tracking-tight group-hover:text-primary transition-colors">
            Uprising
          </span>
        </button>

        {/* Center Nav */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${isActive(item.path)
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
            >
              <item.icon size={16} />
              {item.label}
              {isActive(item.path) && (
                <div className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          ))}
          {isAdmin && (
            <>
              <button
                onClick={() => navigate("/admin")}
                onMouseEnter={() => prefetchRoute("/admin")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive("/admin")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Shield size={16} />
                Admin
              </button>
              <button
                onClick={() => navigate("/org")}
                onMouseEnter={() => prefetchRoute("/org")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive("/org")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <Building2 size={16} />
                Stichting
              </button>
              <button
                onClick={() => navigate("/admin-taken")}
                onMouseEnter={() => prefetchRoute("/admin-taken")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive("/admin-taken")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <ListTodo size={16} />
                Taken
              </button>
            </>
          )}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <button
                onClick={() => navigate("/account")}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${isActive("/account")
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <User size={16} />
                <span className="max-w-[120px] truncate">
                  {user.user_metadata?.full_name || "Dashboard"}
                </span>
              </button>
              <button
                onClick={() => signOut()}
                className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
              >
                {lang === "nl" ? "Uitloggen" : "Sign out"}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all"
            >
              <LogIn size={16} />
              {lang === "nl" ? "Inloggen" : "Log in"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default DesktopNav;
