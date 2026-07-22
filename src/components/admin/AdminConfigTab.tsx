import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Save, Loader2, ChevronRight, RefreshCw, Settings,
  DollarSign, Home, Layers, Shield, Info, Megaphone, Search,
  Eye, EyeOff, ArrowUp, ArrowDown, Clock, Lock, MapPin, Phone,
  Package, ToggleLeft, ToggleRight, Plus, Trash2, Copy, Undo2,
  Upload, Image as ImageIcon, X
} from "lucide-react";
import { inlineToast as toast } from "@/components/InlineToast";

const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

interface ConfigRow {
  id: string;
  config_key: string;
  config_value: any;
  category: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

const categoryIcons: Record<string, any> = {
  spaces: MapPin, booking: Clock, memberships: Shield, pricing: DollarSign,
  homepage: Home, features: Layers, services: Package, general: Info,
  access: Lock, support: Phone,
};

const categoryLabels: Record<string, string> = {
  spaces: "Ruimtes & Studios", booking: "Boekingsregels",
  memberships: "Memberships & Abonnementen", pricing: "Prijzen",
  homepage: "Homepage", features: "Feature Toggles",
  services: "Diensten", general: "Algemeen",
  access: "Toegang & Nuki", support: "Support & Contact",
};

const categoryDescriptions: Record<string, string> = {
  spaces: "Beheer studio's, prijzen en capaciteit",
  booking: "Minimale/maximale duur en extra's",
  memberships: "Abonnementen, prijzen en uren",
  pricing: "Mix/master en producer tarieven",
  homepage: "Hero content, secties en snelle acties",
  features: "Functies in/uitschakelen",
  services: "Diensten configuratie",
  general: "Overige instellingen",
  access: "Slotbeheer en toegangsinstellingen",
  support: "Contactgegevens en openingstijden",
};

const featureFlagLabels: Record<string, { label: string; desc: string }> = {
  maintenance_mode: { label: "Onderhoudsmodus", desc: "App is niet bereikbaar voor gebruikers" },
  booking_enabled: { label: "Boekingen", desc: "Studio boekingen inschakelen" },
  mix_master_enabled: { label: "Mix & Master", desc: "Mix/master service inschakelen" },
  producer_sessions_enabled: { label: "Producer Sessies", desc: "Producer sessie boekingen" },
  memberships_enabled: { label: "Memberships", desc: "Abonnementen systeem" },
  broedplaats_enabled: { label: "Broedplaats", desc: "Broedplaats community" },
  content_requests_enabled: { label: "Content Aanvragen", desc: "Content request formulier" },
  ai_assistant_enabled: { label: "AI Assistent", desc: "AI chat assistent" },
  referrals_enabled: { label: "Referrals", desc: "Verwijzingsprogramma" },
  print_shop_visible: { label: "Drukkerij", desc: "Drukkerij dienst zichtbaar" },
  status_bar_visible: { label: "Statusbalk", desc: "AI-knop en meldingenbel in de header (mobiel)" },
};

function friendlyConfigName(key: string): string {
  const names: Record<string, string> = {
    studios: "Studio's", membership_tiers: "Membership Niveaus",
    booking_rules: "Boekingsregels", mix_master_pricing: "Mix & Master Prijzen",
    producer_pricing: "Producer Prijzen", quick_actions: "Snelle Acties (Homepage)",
    homepage_sections: "Homepage Secties", hero_content: "Hero Banner",
    studio_display_names: "Studio Weergavenamen", broedplaats_plans: "Broedplaats Plannen",
    broedplaats_schedule: "Broedplaats Rooster", support_info: "Contactgegevens & Support",
    services_categories: "Diensten Categorieën", services: "Diensten (Tekst, Prijzen & Foto's)",
    print_shop: "Drukkerij / Print Shop",
    nuki_settings: "Nuki Slot Instellingen", access_settings: "Toegangsinstellingen",
  };
  return names[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function friendlyFieldName(key: string): string {
  const map: Record<string, string> = {
    id: "ID", nameKey: "Naam", descKey: "Beschrijving", pricePerHour: "Prijs/uur",
    priceMonthly: "Prijs/maand", priceYearly: "Prijs/jaar", maxHours: "Max uren/maand",
    maxBookings: "Max boekingen", discount: "Korting", equipment: "Apparatuur",
    capacity: "Capaciteit", size: "Grootte", availability: "Beschikbaarheid",
    labelKey: "Label", path: "Pad", visible: "Zichtbaar", sort: "Volgorde",
    icon: "Icoon", titleNl: "Titel (NL)", titleEn: "Titel (EN)",
    subtitleKey: "Ondertitel sleutel", ctaPath: "CTA link", ctaLabelKey: "CTA label",
    email: "E-mail", phone: "Telefoon", address: "Adres",
    openingHours: "Openingstijden", googleMapsUrl: "Google Maps URL",
    basePrice: "Basisprijs", proDiscount: "Pro korting",
    unlimitedDiscount: "Unlimited korting", depositAmount: "Aanbetaling",
    min_duration: "Min. duur", max_duration: "Max. duur", extras: "Extra's",
    price: "Prijs", name: "Naam", desc: "Beschrijving", description: "Beschrijving",
    message: "Bericht", type: "Type", link: "Link", requestOnly: "Alleen op aanvraag",
    is_active: "Actief", config_key: "Sleutel", config_value: "Waarde",
    slot_type: "Slot type", start_time: "Starttijd", end_time: "Eindtijd",
    title: "Titel", subtitle: "Ondertitel", color: "Kleur", bg: "Achtergrond",
    studio_id: "Studio ID", smartlock_id: "Smartlock ID",
    buffer_minutes: "Buffer (min)", auto_provision: "Auto toewijzing",
    imageUrl: "Afbeelding", descNl: "Beschrijving (NL)", descEn: "Beschrijving (EN)",
    priceNl: "Prijs (NL)", priceEn: "Prijs (EN)",
  };
  return map[key] || key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// ========== IMAGE UPLOAD FIELD ==========

const ImageUploadField = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "webp";
      const fileName = `config/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (uploadError) throw uploadError;
      const { data: signedData, error: signError } = await supabase.storage.from("uploads").createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
      if (signError || !signedData?.signedUrl) throw signError || new Error("Failed to create signed URL");
      onChange(signedData.signedUrl);
      toast.success("Afbeelding geüpload ✅");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Upload mislukt: " + (err?.message || "onbekende fout"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="Preview" className="h-24 w-auto rounded-lg border border-border object-cover" />
          <button
            onClick={() => onChange("")}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground shadow-sm"
          >
            <X size={10} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "Uploaden..." : value ? "Vervangen" : "Upload afbeelding"}
        </button>
        {!value && (
          <span className="text-[10px] text-muted-foreground italic">Geen afbeelding ingesteld</span>
        )}
      </div>
    </div>
  );
};

// ========== DEEP FIELD EDITOR ==========

const DeepFieldEditor = ({ value, onChange, path = "", fieldKey = "" }: {
  value: any; onChange: (v: any) => void; path?: string; fieldKey?: string;
}) => {
  if (value === null || value === undefined) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground italic">null</span>
        <button
          onClick={() => onChange("")}
          className="text-[9px] text-primary underline"
        >
          Waarde instellen
        </button>
      </div>
    );
  }

  if (typeof value === "boolean") {
    return (
      <button
        onClick={() => onChange(!value)}
        className="flex items-center gap-1.5"
      >
        {value ? (
          <ToggleRight size={20} className="text-success" />
        ) : (
          <ToggleLeft size={20} className="text-muted-foreground" />
        )}
        <span className={`text-xs font-semibold ${value ? "text-success" : "text-muted-foreground"}`}>
          {value ? "Aan" : "Uit"}
        </span>
      </button>
    );
  }

  if (typeof value === "number") {
    return (
      <NumberFieldInput value={value} onChange={onChange} />
    );
  }

  if (typeof value === "string") {
    // Image upload for fields named imageUrl, image, etc.
    if (fieldKey.toLowerCase().includes("imageurl") || fieldKey.toLowerCase().includes("image_url")) {
      return <ImageUploadField value={value} onChange={onChange} />;
    }
    // Long strings get textarea
    if (value.length > 80) {
      return <TextAreaFieldInput value={value} onChange={onChange} />;
    }
    return <TextFieldInput value={value} onChange={onChange} />;
  }

  if (Array.isArray(value)) {
    return <ArrayFieldEditor value={value} onChange={onChange} path={path} />;
  }

  if (typeof value === "object") {
    return <ObjectFieldEditor value={value} onChange={onChange} path={path} />;
  }

  return <TextFieldInput value={String(value)} onChange={onChange} />;
};

// ========== PRIMITIVE INPUTS ==========

const TextFieldInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [local, setLocal] = useState(value);
  const changed = local !== value;

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
          changed ? "bg-primary/5 border-primary/40" : "bg-secondary border-border"
        }`}
      />
      {changed && (
        <button
          onClick={() => onChange(local)}
          className="shrink-0 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-bold text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"
        >
          <Save size={10} /> Opslaan
        </button>
      )}
    </div>
  );
};

const TextAreaFieldInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
  const [local, setLocal] = useState(value);
  const changed = local !== value;

  useEffect(() => { setLocal(value); }, [value]);

  return (
    <div className="space-y-1.5">
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        rows={3}
        className={`w-full rounded-lg border px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
          changed ? "bg-primary/5 border-primary/40" : "bg-secondary border-border"
        }`}
      />
      {changed && (
        <button
          onClick={() => onChange(local)}
          className="rounded-lg bg-primary px-3 py-1.5 text-[10px] font-bold text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"
        >
          <Save size={10} /> Opslaan
        </button>
      )}
    </div>
  );
};

const NumberFieldInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [local, setLocal] = useState(String(value));
  const numLocal = parseFloat(local);
  const changed = !isNaN(numLocal) && numLocal !== value;

  useEffect(() => { setLocal(String(value)); }, [value]);

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step="any"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={`w-28 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-right focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
          changed ? "bg-primary/5 border-primary/40" : "bg-secondary border-border"
        }`}
      />
      {changed && (
        <button
          onClick={() => { if (!isNaN(numLocal)) onChange(numLocal); }}
          className="shrink-0 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-bold text-primary-foreground flex items-center gap-1 hover:bg-primary/90 transition-colors"
        >
          <Save size={10} /> Opslaan
        </button>
      )}
    </div>
  );
};

// ========== ARRAY EDITOR ==========

const ArrayFieldEditor = ({ value, onChange, path }: {
  value: any[]; onChange: (v: any[]) => void; path: string;
}) => {
  const confirm = useConfirm();
  // Simple string/number array
  if (value.length === 0 || typeof value[0] === "string" || typeof value[0] === "number") {
    return <SimpleArrayEditor value={value} onChange={onChange} />;
  }

  // Array of objects
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-secondary/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
              {item.id || item.name || item.labelKey || item.title || `#${i + 1}`}
            </span>
            <div className="flex items-center gap-1">
              {i > 0 && (
                <button
                  onClick={() => {
                    const arr = [...value];
                    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
                    onChange(arr);
                  }}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <ArrowUp size={12} />
                </button>
              )}
              {i < value.length - 1 && (
                <button
                  onClick={() => {
                    const arr = [...value];
                    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
                    onChange(arr);
                  }}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <ArrowDown size={12} />
                </button>
              )}
              <button
                onClick={() => {
                  const arr = [...value];
                  arr.push(JSON.parse(JSON.stringify(item)));
                  onChange(arr);
                }}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                title="Dupliceren"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={async () => {
                  if (await confirm({ title: "Dit item verwijderen?", destructive: true })) {
                    onChange(value.filter((_, idx) => idx !== i));
                  }
                }}
                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                title="Verwijderen"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
          <ObjectFieldEditor
            value={item}
            onChange={(updated) => {
              const arr = [...value];
              arr[i] = updated;
              onChange(arr);
            }}
            path={`${path}[${i}]`}
          />
        </div>
      ))}
      <button
        onClick={() => {
          // Clone structure of first item with empty values
          const template = value.length > 0
            ? Object.fromEntries(Object.entries(value[0]).map(([k, v]) => {
                if (typeof v === "string") return [k, ""];
                if (typeof v === "number") return [k, 0];
                if (typeof v === "boolean") return [k, false];
                if (Array.isArray(v)) return [k, []];
                if (v === null) return [k, null];
                if (typeof v === "object") return [k, {}];
                return [k, ""];
              }))
            : {};
          onChange([...value, template]);
        }}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-border py-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
      >
        <Plus size={12} /> Item toevoegen
      </button>
    </div>
  );
};

const SimpleArrayEditor = ({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) => {
  const [newItem, setNewItem] = useState("");

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-1 rounded-lg bg-secondary border border-border px-2 py-1">
            <SimpleArrayItemInput
              value={item}
              onChange={(v) => {
                const arr = [...value];
                arr[i] = v;
                onChange(arr);
              }}
            />
            <button
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive ml-0.5"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newItem.trim()) {
              onChange([...value, newItem.trim()]);
              setNewItem("");
            }
          }}
          placeholder="Nieuw item..."
          className="flex-1 rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => {
            if (newItem.trim()) {
              onChange([...value, newItem.trim()]);
              setNewItem("");
            }
          }}
          className="rounded-lg bg-primary/10 text-primary px-2 py-1.5 text-xs font-semibold hover:bg-primary/20 transition-colors"
        >
          <Plus size={12} />
        </button>
      </div>
    </div>
  );
};

const SimpleArrayItemInput = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(String(value));

  if (editing) {
    return (
      <input
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { onChange(local); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onChange(local); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-24 bg-background border border-primary rounded px-1 py-0.5 text-[11px] focus:outline-none"
      />
    );
  }

  return (
    <button
      onClick={() => { setLocal(String(value)); setEditing(true); }}
      className="text-[11px] font-medium hover:text-primary transition-colors"
    >
      {String(value)}
    </button>
  );
};

// ========== OBJECT EDITOR ==========

const ObjectFieldEditor = ({ value, onChange, path }: {
  value: Record<string, any>; onChange: (v: any) => void; path: string;
}) => {
  const entries = Object.entries(value);

  return (
    <div className="space-y-2.5">
      {entries.map(([key, val]) => (
        <div key={key}>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
            {friendlyFieldName(key)}
            <span className="ml-1.5 text-[8px] font-mono text-muted-foreground/50">{key}</span>
          </label>
          <DeepFieldEditor
            value={val}
            onChange={(newVal) => onChange({ ...value, [key]: newVal })}
            path={`${path}.${key}`}
            fieldKey={key}
          />
        </div>
      ))}
    </div>
  );
};

// ========== CONFIG ITEM WITH SUBMIT ==========

const ConfigItemEditor = ({ cfg, onSaved }: { cfg: ConfigRow; onSaved: () => void }) => {
  const [localValue, setLocalValue] = useState<any>(JSON.parse(JSON.stringify(cfg.config_value)));
  const [saving, setSaving] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const hasChanges = JSON.stringify(localValue) !== JSON.stringify(cfg.config_value);

  // Reset when source changes
  useEffect(() => {
    setLocalValue(JSON.parse(JSON.stringify(cfg.config_value)));
  }, [cfg.config_value]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await (supabase.from as any)("app_config")
        .update({ config_value: localValue, updated_at: new Date().toISOString() })
        .eq("config_key", cfg.config_key);
      if (error) throw error;
      toast.success("✅ Opgeslagen — wijzigingen zijn direct live");
      onSaved();
    } catch {
      toast.error("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  const handleJsonSave = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(jsonText);
      const { error } = await (supabase.from as any)("app_config")
        .update({ config_value: parsed, updated_at: new Date().toISOString() })
        .eq("config_key", cfg.config_key);
      if (error) throw error;
      toast.success("✅ Opgeslagen via JSON");
      setShowJson(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message?.includes("JSON") ? "Ongeldige JSON syntax" : "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-3">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs font-semibold">{friendlyConfigName(cfg.config_key)}</p>
          {cfg.description && <p className="text-[10px] text-muted-foreground">{cfg.description}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          {hasChanges && !showJson && (
            <button
              onClick={() => setLocalValue(JSON.parse(JSON.stringify(cfg.config_value)))}
              className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-secondary rounded-lg px-2 py-1 hover:bg-secondary/80 transition-colors"
              title="Wijzigingen ongedaan maken"
            >
              <Undo2 size={10} /> Reset
            </button>
          )}
          <button
            onClick={() => {
              if (!showJson) setJsonText(JSON.stringify(localValue, null, 2));
              setShowJson(!showJson);
            }}
            className={`flex items-center gap-1 text-[10px] font-semibold rounded-lg px-2 py-1 transition-colors ${
              showJson ? "bg-primary text-primary-foreground" : "text-primary bg-primary/10 hover:bg-primary/20"
            }`}
          >
            {showJson ? "Visual" : "JSON"}
          </button>
        </div>
      </div>

      {showJson ? (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={Math.min(20, jsonText.split("\n").length + 2)}
            className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-xs font-mono text-foreground resize-y min-h-[100px] focus:outline-none focus:ring-1 focus:ring-primary"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowJson(false)}
              className="flex-1 rounded-lg bg-secondary py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleJsonSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground flex items-center justify-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Opslaan & Live
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <DeepFieldEditor
            value={localValue}
            onChange={setLocalValue}
            path={cfg.config_key}
          />
          {/* Submit button — always visible when there are changes */}
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full mt-2 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground flex items-center justify-center gap-1.5 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Wijzigingen opslaan & doorvoeren
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

// ========== MAIN COMPONENT ==========

const AdminConfigTab = () => {
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from as any)("app_config")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      setConfigs(data || []);
    } catch {
      toast.error("Configuratie laden mislukt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfigs(); }, []);

  const categories = [...new Set(configs.map(c => c.category))];

  const toggleFeatureFlag = async (flagKey: string, currentValue: boolean) => {
    const featureConfig = configs.find(c => c.config_key === "feature_flags");
    if (!featureConfig) return;
    const updated = { ...featureConfig.config_value, [flagKey]: !currentValue };
    try {
      const { error } = await (supabase.from as any)("app_config")
        .update({ config_value: updated, updated_at: new Date().toISOString() })
        .eq("config_key", "feature_flags");
      if (error) throw error;
      toast.success(`${featureFlagLabels[flagKey]?.label || flagKey} ${!currentValue ? "ingeschakeld ✅" : "uitgeschakeld ❌"}`);
      loadConfigs();
    } catch {
      toast.error("Toggle mislukt");
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  const featureFlagsConfig = configs.find(c => c.config_key === "feature_flags");
  const bannerConfig = configs.find(c => c.config_key === "announcement_banner");

  const filteredCategories = searchQuery
    ? categories.filter(cat => {
        const catConfigs = configs.filter(c => c.category === cat);
        return catConfigs.some(c =>
          c.config_key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (categoryLabels[cat] || cat).toLowerCase().includes(searchQuery.toLowerCase())
        );
      })
    : categories;

  return (
    <div className="space-y-4" data-toast-section>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold font-display">⚙️ App Configuratie</h2>
          <p className="text-[10px] text-muted-foreground">Elk veld is bewerkbaar • Klik op waarden om aan te passen • Submit per sectie</p>
        </div>
        <button onClick={loadConfigs} className="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={12} /> Vernieuw
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Zoek in configuratie..."
          className="w-full rounded-xl bg-card border border-border pl-9 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
        />
      </div>

      {/* Feature Flags */}
      {featureFlagsConfig && !searchQuery && (
        <motion.div variants={item} className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Layers size={14} className="text-primary" /> Feature Toggles
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Schakel functies in of uit — direct live</p>
          <div className="space-y-1">
            {Object.entries(featureFlagsConfig.config_value as Record<string, boolean>).map(([key, value]) => {
              const meta = featureFlagLabels[key];
              const isDestructive = key === "maintenance_mode";
              return (
                <button
                  key={key}
                  onClick={() => toggleFeatureFlag(key, value)}
                  className={`w-full flex items-center justify-between rounded-lg p-3 text-left transition-all ${
                    isDestructive && value ? "bg-destructive/10 border border-destructive/30" : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold ${isDestructive && value ? "text-destructive" : ""}`}>
                      {meta?.label || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    {meta?.desc && <p className="text-[10px] text-muted-foreground truncate">{meta.desc}</p>}
                  </div>
                  <div className="ml-3 shrink-0">
                    {value ? (
                      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        isDestructive ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isDestructive ? "bg-destructive" : "bg-success"} animate-pulse`} />
                        Aan
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                        Uit
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Banner Editor */}
      {bannerConfig && !searchQuery && (
        <motion.div variants={item} className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <Megaphone size={14} className="text-primary" /> Aankondigingsbanner
          </h3>
          <p className="text-[10px] text-muted-foreground mb-3">Banner bovenaan de homepage</p>
          <ConfigItemEditor cfg={bannerConfig} onSaved={loadConfigs} />
        </motion.div>
      )}

      {/* Config Categories */}
      {filteredCategories.filter(c => c !== "features").map(cat => {
        const catConfigs = configs.filter(c =>
          c.category === cat &&
          c.config_key !== "feature_flags" &&
          c.config_key !== "announcement_banner" &&
          (!searchQuery || c.config_key.toLowerCase().includes(searchQuery.toLowerCase()))
        );
        if (catConfigs.length === 0) return null;
        const Icon = categoryIcons[cat] || Settings;
        const isExpanded = expandedCategory === cat;

        return (
          <motion.div key={cat} variants={item} className="rounded-xl bg-card border border-border overflow-hidden">
            <button
              onClick={() => setExpandedCategory(isExpanded ? null : cat)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/20 shrink-0">
                <Icon size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{categoryLabels[cat] || cat}</h3>
                <p className="text-[10px] text-muted-foreground">{categoryDescriptions[cat] || `${catConfigs.length} instelling(en)`}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] bg-secondary rounded-full px-2 py-0.5 text-muted-foreground font-medium">
                  {catConfigs.length}
                </span>
                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight size={14} className="text-muted-foreground" />
                </motion.div>
              </div>
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border px-4 pb-4 space-y-3">
                    {catConfigs.map(cfg => (
                      <ConfigItemEditor key={cfg.config_key} cfg={cfg} onSaved={loadConfigs} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
};

export default AdminConfigTab;
