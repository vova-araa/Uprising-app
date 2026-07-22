import { useI18n, type Lang } from "@/lib/i18n";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles, Mic, Camera, Printer, Users, Music, ChevronRight,
} from "lucide-react";
import SEO from "@/components/SEO";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

type LocalizedText = Record<Lang, string>;

interface ServiceCategory {
  id: string;
  label: LocalizedText;
  icon: any;
  description: LocalizedText;
}

const getLocalized = (text: LocalizedText, lang: Lang) => text[lang] || text.en;

const categories: ServiceCategory[] = [
  {
    id: "memberships",
    label: {
      nl: "Producer Memberships",
      en: "Producer Memberships",
      de: "Producer Mitgliedschaften",
      fr: "Abonnements Producteur",
      es: "Membresías para Productores",
      tr: "Prodüktör Üyelikleri",
      ar: "عضويات المنتجين",
      hy: "Producer Memberships",
    },
    icon: Sparkles,
    description: {
      nl: "3-maanden en jaarplannen met studio-uren voor producers",
      en: "3-month and yearly plans with studio hours for producers",
      de: "3-Monats- und Jahrespläne mit Studiozeiten für Produzenten",
      fr: "Forfaits de 3 mois et annuels avec heures studio pour producteurs",
      es: "Planes de 3 meses y anuales con horas de estudio para productores",
      tr: "Prodüktörler için 3 aylık ve yıllık stüdyo planları",
      ar: "خطط 3 أشهر وسنوية مع ساعات استوديو للمنتجين",
      hy: "3-month and yearly plans with studio hours for producers",
    },
  },
  {
    id: "broedplaats",
    label: {
      nl: "Broedplaats",
      en: "Creative Hub",
      de: "Creative Hub",
      fr: "Hub Créatif",
      es: "Hub Creativo",
      tr: "Yaratıcı Merkez",
      ar: "المركز الإبداعي",
      hy: "Ստեղծարար հաբ",
    },
    icon: Users,
    description: {
      nl: "Creatieve community & netwerk events",
      en: "Creative community & networking events",
      de: "Kreative Community & Networking-Events",
      fr: "Communauté créative et événements de networking",
      es: "Comunidad creativa y eventos de networking",
      tr: "Yaratıcı topluluk ve networking etkinlikleri",
      ar: "مجتمع إبداعي وفعاليات تواصل",
      hy: "Ստեղծարար համայնք և ցանցային միջոցառումներ",
    },
  },
  {
    id: "studio-session",
    label: {
      nl: "Studio Sessie",
      en: "Studio Session",
      de: "Studio-Session",
      fr: "Session Studio",
      es: "Sesión de Estudio",
      tr: "Stüdyo Seansı",
      ar: "جلسة استوديو",
      hy: "Ստուդիայի սեսիա",
    },
    icon: Mic,
    description: {
      nl: "Opnamesessies in professionele studio's",
      en: "Recording sessions in professional studios",
      de: "Aufnahmesessions in professionellen Studios",
      fr: "Sessions d'enregistrement en studio professionnel",
      es: "Sesiones de grabación en estudios profesionales",
      tr: "Profesyonel stüdyolarda kayıt seansları",
      ar: "جلسات تسجيل في استوديوهات احترافية",
      hy: "Ձայնագրման սեսիաներ պրոֆեսիոնալ ստուդիաներում",
    },
  },
  {
    id: "producer-session",
    label: {
      nl: "Producer Sessie",
      en: "Producer Session",
      de: "Produzenten-Session",
      fr: "Session Producteur",
      es: "Sesión con Productor",
      tr: "Prodüktör Seansı",
      ar: "جلسة منتج",
      hy: "Պրոդյուսերի սեսիա",
    },
    icon: Music,
    description: {
      nl: "Werk samen met ervaren producers",
      en: "Work with experienced producers",
      de: "Arbeite mit erfahrenen Produzenten",
      fr: "Travaillez avec des producteurs expérimentés",
      es: "Trabaja con productores experimentados",
      tr: "Deneyimli prodüktörlerle çalış",
      ar: "اعمل مع منتجين ذوي خبرة",
      hy: "Աշխատիր փորձառու պրոդյուսերների հետ",
    },
  },
  {
    id: "content",
    label: {
      nl: "Content",
      en: "Content",
      de: "Content",
      fr: "Contenu",
      es: "Contenido",
      tr: "İçerik",
      ar: "المحتوى",
      hy: "Քոնթենթ",
    },
    icon: Camera,
    description: {
      nl: "Foto, video & podcast productie",
      en: "Photo, video & podcast production",
      de: "Foto-, Video- & Podcast-Produktion",
      fr: "Production photo, vidéo et podcast",
      es: "Producción de foto, video y podcast",
      tr: "Fotoğraf, video ve podcast prodüksiyonu",
      ar: "إنتاج الصور والفيديو والبودكاست",
      hy: "Լուսանկար, վիդեո և փոդքասթ արտադրություն",
    },
  },
  {
    id: "drukkerij",
    label: {
      nl: "Drukkerij",
      en: "Print Shop",
      de: "Druckerei",
      fr: "Imprimerie",
      es: "Imprenta",
      tr: "Baskı Atölyesi",
      ar: "المطبعة",
      hy: "Տպարան",
    },
    icon: Printer,
    description: {
      nl: "Custom prints, kleding en merchandise",
      en: "Custom prints, clothing and merchandise",
      de: "Individuelle Drucke, Kleidung und Merchandise",
      fr: "Impressions personnalisées, vêtements et merchandising",
      es: "Impresiones personalizadas, ropa y merchandising",
      tr: "Özel baskılar, giyim ve merchandise",
      ar: "طباعة مخصصة وملابس ومنتجات دعائية",
      hy: "Պատվերով տպագրություն, հագուստ և merchandising",
    },
  },
];

const pageTitle: LocalizedText = {
  nl: "Diensten",
  en: "Services",
  de: "Dienste",
  fr: "Services",
  es: "Servicios",
  tr: "Hizmetler",
  ar: "الخدمات",
  hy: "Ծառայություններ",
};

const pageSubtitle: LocalizedText = {
  nl: "Ontdek ons volledige aanbod",
  en: "Discover our full range of services",
  de: "Entdecke unser vollständiges Angebot",
  fr: "Découvrez toute notre offre",
  es: "Descubre toda nuestra oferta",
  tr: "Hizmetlerimizin tamamını keşfet",
  ar: "اكتشف كامل خدماتنا",
  hy: "Բացահայտիր մեր ամբողջ առաջարկը",
};

const DienstenPage = () => {
  const { lang } = useI18n();
  const navigate = useNavigate();

  return (
    <div className="min-h-full pb-24 lg:pb-12">
      <SEO title="Diensten overzicht — Uprising Studio" description="Bekijk alle creatieve diensten en pakketten van Uprising Studio in Amersfoort." path="/diensten" />
      <div className="px-5 lg:px-8 pt-6 pb-2">
        <h1 className="text-2xl lg:text-3xl font-bold font-display">{getLocalized(pageTitle, lang)}</h1>
        <p className="text-sm lg:text-base text-muted-foreground mt-1">{getLocalized(pageSubtitle, lang)}</p>
      </div>

      <motion.div variants={container} initial="hidden" animate="show" className="px-5 lg:px-8 space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 mt-4">
        {categories.map((cat) => (
          <motion.div key={cat.id} variants={item}>
            <button
              onClick={() => navigate(`/diensten/${cat.id}`)}
              className="group relative flex w-full items-center gap-4 rounded-2xl card-premium border border-border p-4 lg:p-5 text-left transition-all hover:border-primary/40 active:scale-[0.99] lg:hover:scale-[1.01] lg:hover:-translate-y-0.5 lg:hover:shadow-glow overflow-hidden"
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                <cat.icon size={22} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold font-display text-base">{getLocalized(cat.label, lang)}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{getLocalized(cat.description, lang)}</p>
              </div>
              <ChevronRight size={18} className="text-muted-foreground shrink-0 lg:group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default DienstenPage;
