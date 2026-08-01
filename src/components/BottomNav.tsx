import { useLocation, useNavigate } from "react-router-dom";
import { Home, CalendarDays, MapPin, LayoutGrid, Shield, User, LogIn, Building2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState, useCallback } from "react";
import { useAdminRole } from "@/hooks/useAdminRole";
import { haptics } from "@/hooks/useHaptics";
import { prefetchRoute } from "@/lib/prefetch";

type L = Record<Lang, string>;

const baseNavItems: {path: string;icon: any;label: L;adminOnly: boolean;}[] = [
{ path: "/", icon: Home, label: { nl: "Home", en: "Home", de: "Home", fr: "Accueil", es: "Inicio", tr: "Ana Sayfa", ar: "الرئيسية", hy: "Home" }, adminOnly: false },
{ path: "/diensten", icon: LayoutGrid, label: { nl: "Diensten", en: "Services", de: "Dienste", fr: "Services", es: "Servicios", tr: "Hizmetler", ar: "الخدمات", hy: "Services" }, adminOnly: false },
{ path: "/book", icon: CalendarDays, label: { nl: "Boeken", en: "Book", de: "Buchen", fr: "Réserver", es: "Reservar", tr: "Rezerve", ar: "حجز", hy: "Book" }, adminOnly: false },
{ path: "/spaces", icon: MapPin, label: { nl: "Ruimtes", en: "Spaces", de: "Räume", fr: "Espaces", es: "Espacios", tr: "Alanlar", ar: "المساحات", hy: "Spaces" }, adminOnly: false },
{ path: "/account", icon: User, label: { nl: "Dashboard", en: "Dashboard", de: "Dashboard", fr: "Tableau", es: "Panel", tr: "Panel", ar: "لوحة", hy: "Dashboard" }, adminOnly: false },
];

const loginNavItem = { path: "/auth", icon: LogIn, label: { nl: "Inloggen", en: "Log in", de: "Anmelden", fr: "Connexion", es: "Iniciar", tr: "Giriş", ar: "دخول", hy: "Մուտք" } as L, adminOnly: false };

const adminNavItem = { path: "/admin", icon: Shield, label: { nl: "Admin", en: "Admin", de: "Admin", fr: "Admin", es: "Admin", tr: "Yönetim", ar: "إدارة", hy: "Admin" } as L, adminOnly: true };
const orgNavItem = { path: "/org", icon: Building2, label: { nl: "Stichting", en: "Foundation", de: "Stiftung", fr: "Fondation", es: "Fundación", tr: "Vakıf", ar: "مؤسسة", hy: "Foundation" } as L, adminOnly: true };

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const [navHighlight, setNavHighlight] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setNavHighlight(document.documentElement.classList.contains("nav-highlight"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  let navItems;
  if (user) {
    navItems = isAdmin ? [...baseNavItems, adminNavItem, orgNavItem] : baseNavItems;
  } else {
    const publicItems = baseNavItems.filter(item => item.path !== "/account");
    navItems = [...publicItems, loginNavItem];
  }

  return (
    <nav
      aria-label="Main navigation"
      className={`nav-pill fixed z-50 rounded-[26px] transition-colors lg:hidden ${navHighlight ? "ring-1 ring-primary" : ""}`}
      style={{
        left: "max(env(safe-area-inset-left, 0px) + 12px, 12px)",
        right: "max(env(safe-area-inset-right, 0px) + 12px, 12px)",
        bottom: "max(env(safe-area-inset-bottom, 0px), 12px)",
      }}
    >
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
          item.path !== "/" && location.pathname.startsWith(item.path);
          return (
             <button
              key={item.path}
              onClick={() => { haptics.light(); navigate(item.path); }}
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              aria-label={item.label[lang] || item.label.en}
              aria-current={isActive ? "page" : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 px-1 py-1 transition-colors min-w-0 active:scale-95 active:opacity-80">

              <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200 ${isActive ? "gradient-primary shadow-glow-strong" : ""}`}>
                <item.icon
                  size={19}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? "text-white" : "text-muted-foreground"} />
              </div>

              <span
                className={`text-[10px] leading-none ${
                isActive ? "font-bold text-[hsl(var(--nav-active))]" : "font-medium text-muted-foreground"}`
                }>
                {item.label[lang] || item.label.en}
              </span>
            </button>);
        })}
      </div>
    </nav>);
};


export default BottomNav;