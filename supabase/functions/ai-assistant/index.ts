import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Je bent de AI Studio Assistent van Uprising Studio in Amersfoort (Spaceshuttle 6e, Amersfoort). Je helpt artiesten en creatieve professionals met het kiezen van de juiste studio's, diensten en sessie-opzet.

LOCATIE:
- Adres: Spaceshuttle 6e, Amersfoort
- Openingstijden: 24/7 self-service — je boekt in de app en opent de voordeur met de app (Nuki smart lock, de deur opent automatisch na ontgrendelen). Toegang werkt vanaf 15 minuten voor je sessie tot het einde van je sessie.

STUDIO'S:
- Studio 1 (50m², max 6 personen): Professionele opnamestudio (€50/uur) - Neumann TLM103, Focusrite Scarlett, Adams A77X, Arturia Piano, Meerdere gitaren. Ideaal voor professionele vocale opnames, producties en mixing.
- Studio 2 (25m², max 4 personen): Compacte studio (€30/uur) - Adams A77X, Yamaha HS7, Akai Mini Keyboard, Focusrite Scarlett. Perfect voor solo sessies, demo's en schrijfsessies.
- Content Room (40m², max 4 personen): Content creatie ruimte (€35/uur) - Camera, LED Panels, Green Screen, White Screen, Black Screen, Teleprompter, Podcast Setup. Voor foto, video, podcast en content productie.
- Drukkerij (15m²): Professionele print diensten.

DIENSTEN:
- Mix & Master: €150 per track
- Producer Sessie: €350 per single (vooruitbetaling vereist)
- Fotograaf / Content Creator: Op aanvraag
- Kleding & Merchandise: Op aanvraag

MEMBERSHIPS:
- Basic: €150/mnd (of €100/mnd bij jaarcontract) - 8 uur/maand, Studio's & Content Room
- Pro: €250/mnd (of €200/mnd bij jaarcontract) - 16 uur/maand, alle studio's, 10% korting op extras
- Unlimited: €350/mnd (of €300/mnd bij jaarcontract) - Onbeperkt, priority booking, 20% korting op extras
- Business: Op aanvraag - voor labels & bedrijven, meerdere gebruikers, facturatie

RICHTLIJNEN VOOR SESSIEDUUR:
- Enkele track opname: 2-3 uur
- EP sessie (3-5 tracks): 8-12 uur
- Album sessie: 20-40 uur
- Podcast opname: 2-3 uur
- Content/fotoshoot: 2-4 uur
- Muziekvideo: 4-8 uur

BELANGRIJK: Uprising Studio zit in AMERSFOORT, NIET in Den Haag of een andere stad. Verwijs altijd naar de correcte locatie.

BOEKEN VIA CHAT:
Jij kunt een boekingsvoorstel doen dat de gebruiker met één tap bevestigt. Werkwijze:
1. Verzamel: welke ruimte (studio-1, studio-2 of content-room), datum, starttijd en duur (2 t/m 12 hele uren). Studio's zijn 24/7 boekbaar.
2. Zodra je ALLE vier de gegevens hebt, sluit je antwoord af met exact dit blok (en verder niets erachter):
\`\`\`booking
{"studio_id": "studio-1", "booking_date": "2026-01-31", "start_time": "20:00", "duration_hours": 3}
\`\`\`
3. Gebruik het blok alleen bij een concreet boekingsverzoek, maximaal één blok per antwoord, en nooit met onvolledige gegevens — vraag dan eerst door.
4. Het systeem checkt daarna zelf de beschikbaarheid en toont een bevestigingsknop; zeg dus niet dat de boeking al rond is.

Wees vriendelijk, behulpzaam en direct. Geef concrete aanbevelingen. Als de taal Engels is, antwoord in het Engels.`;

const VALID_STUDIOS = new Set(["studio-1", "studio-2", "content-room"]);
const STUDIO_NAMES: Record<string, string> = {
  "studio-1": "Studio 1",
  "studio-2": "Studio 2",
  "content-room": "Content Room",
};

interface BookingProposal {
  studio_id: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  studio_name: string;
  available: boolean;
  alternatives: string[]; // free start times on the same day, if unavailable
}

/**
 * Parse the ```booking fence the model emits and verify the slot against
 * real bookings + room blocks. Returns null when there is no valid fence.
 */
async function extractProposal(content: string): Promise<{ proposal: BookingProposal | null; cleaned: string }> {
  const match = content.match(/```booking\s*([\s\S]*?)```/);
  if (!match) return { proposal: null, cleaned: content };
  const cleaned = content.replace(match[0], "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[1].trim());
  } catch {
    return { proposal: null, cleaned };
  }

  const studio_id = String(parsed.studio_id || "");
  const booking_date = String(parsed.booking_date || "");
  const start_time = String(parsed.start_time || "");
  const duration_hours = Number(parsed.duration_hours);

  if (!VALID_STUDIOS.has(studio_id)) return { proposal: null, cleaned };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking_date) || isNaN(Date.parse(booking_date))) return { proposal: null, cleaned };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start_time)) return { proposal: null, cleaned };
  if (!Number.isInteger(duration_hours) || duration_hours < 2 || duration_hours > 12) return { proposal: null, cleaned };

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Room blocked?
  const { data: blocks } = await admin
    .from("room_blocks").select("blocked_until").eq("studio_id", studio_id).eq("active", true);
  const blocked = (blocks || []).some((b: { blocked_until: string | null }) => !b.blocked_until || new Date(b.blocked_until) > new Date());

  // Overlapping bookings + free alternatives on the same day
  const { data: existing } = await admin
    .from("bookings")
    .select("start_time, duration_hours")
    .eq("studio_id", studio_id)
    .eq("booking_date", booking_date)
    .in("status", ["confirmed", "pending_payment", "pending"]);

  const busy = (existing || []).map((b: { start_time: string; duration_hours: number }) => {
    const [h, m] = String(b.start_time).split(":").map(Number);
    const s = h * 60 + (m || 0);
    return [s, s + (b.duration_hours || 0) * 60] as [number, number];
  });

  const fits = (startMin: number, durH: number) =>
    !busy.some(([s, e]) => startMin < e && startMin + durH * 60 > s);

  const [reqH, reqM] = start_time.split(":").map(Number);
  const available = !blocked && fits(reqH * 60 + (reqM || 0), duration_hours);

  let alternatives: string[] = [];
  if (!available && !blocked) {
    for (let h = 0; h < 24 && alternatives.length < 4; h++) {
      if (fits(h * 60, duration_hours)) alternatives.push(`${String(h).padStart(2, "0")}:00`);
    }
  }

  return {
    proposal: {
      studio_id, booking_date, start_time, duration_hours,
      studio_name: STUDIO_NAMES[studio_id],
      available,
      alternatives,
    },
    cleaned,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, lang } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("API key not configured");

    const todayAms = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
    const dateLine = `\n\nVANDAAG IS: ${todayAms} (gebruik dit voor "morgen", "volgende week", etc.).`;
    const systemPrompt = (lang === "en"
      ? SYSTEM_PROMPT + "\n\nThe user prefers English. Respond in English."
      : SYSTEM_PROMPT) + dateLine;

    // Validate & sanitize user-supplied messages: only allow user/assistant roles,
    // cap message count and per-message length to prevent prompt/role injection.
    const ALLOWED_ROLES = new Set(["user", "assistant"]);
    const safeMessages = Array.isArray(messages)
      ? messages
          .filter((m: any) => m && ALLOWED_ROLES.has(m.role) && typeof m.content === "string")
          .slice(-50)
          .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 4000) }))
      : [];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...safeMessages,
        ],
      }),
    });


    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, probeer het later opnieuw." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits op, neem contact op met de studio." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    // Booking proposal: parse the fence, verify against real availability
    const { proposal, cleaned } = await extractProposal(rawContent);

    return new Response(JSON.stringify({ content: cleaned || rawContent, proposal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("AI assistant error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
