// Coach plan generator: produces a concrete, structured content plan (per-day
// posts with format, idea, caption and hashtags) from the artist's intake and
// their sessions. Two modes:
//   - "weekly": a plan for the current week (one per user per week)
//   - "session": a shot list + post plan tied to a specific booking
// Callable by the user (from the coach page) and by the scheduler/booking
// hooks with a service-role token + explicit user_id.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUDIO_NAMES: Record<string, string> = {
  "studio-1": "Studio 1 (opnamestudio)",
  "studio-2": "Studio 2 (compacte studio)",
  "content-room": "Content Room (camera, green screen, podcast-setup)",
};

function mondayOf(d: Date): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().split("T")[0];
}

function buildProfileBlock(profile: any): string {
  if (!profile) return "Er is nog geen intake ingevuld — maak een algemeen maar bruikbaar plan voor een beginnende artiest.";
  return `ARTIEST-PROFIEL:
- Naam: ${profile.artist_name || "onbekend"}
- Genre: ${profile.genre || "onbekend"}
- Merk/verhaal: ${profile.brand_description || "-"}
- Doelgroep: ${profile.target_audience || "-"}
- Doelen: ${profile.goals || "-"}
- Fase: ${profile.process_stage}
- Socials: ${JSON.stringify(profile.socials || {})} (±${profile.followers_total ?? "?"} volgers)
- Post vooral op: ${(profile.posting_platforms || []).join(", ") || "onbekend"}
- Tijdsbudget voor content: ${profile.time_budget || "-"}
- Geldbudget promo: ${profile.money_budget || "-"}
- Comfort op camera: ${profile.camera_comfort || "-"}
- Sterke kanten: ${profile.strengths || "-"}
- Waar ze mee worstelen: ${profile.struggles || "-"}
- Releases tot nu toe: ${profile.releases || "nog niets"}
- Referentie-artiesten: ${profile.reference_artists || "-"}
- Content-doel: ${profile.weekly_content_goal ?? 3} posts/week
- Releaseplanning: ${JSON.stringify(profile.release_plan || [])}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const body = await req.json().catch(() => ({}));
    const mode: "weekly" | "session" = body.mode === "session" ? "session" : "weekly";
    const bookingId: string | null = body.booking_id || null;

    // Resolve the target user
    let userId: string;
    if (isServiceRole && body.user_id) {
      userId = body.user_id;
    } else {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error } = await supabaseUser.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("API key not configured");

    const { data: profile } = await admin
      .from("creator_profiles").select("*").eq("user_id", userId).maybeSingle();

    const weekStart = mondayOf(new Date());

    // Weekly mode dedup: return the existing plan if one already exists
    if (mode === "weekly") {
      const { data: existing } = await admin
        .from("content_plans")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .eq("source", "weekly")
        .maybeSingle();
      if (existing && !body.force) {
        return new Response(JSON.stringify({ plan: existing, existed: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Session context
    let booking: any = null;
    if (mode === "session" && bookingId) {
      const { data } = await admin
        .from("bookings")
        .select("id, studio_id, booking_date, start_time, duration_hours")
        .eq("id", bookingId)
        .eq("user_id", userId)
        .maybeSingle();
      booking = data;
    }

    // Recent check-ins so the plan adapts to what worked
    const { data: checkins } = await admin
      .from("coach_checkins")
      .select("posted, reflection, reach_note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const goal = profile?.weekly_content_goal || 3;

    const task = mode === "session" && booking
      ? `Maak een SHOT LIST + POSTPLAN rond deze studiosessie:
- Ruimte: ${STUDIO_NAMES[booking.studio_id] || booking.studio_id}
- Datum: ${booking.booking_date} om ${booking.start_time} (${booking.duration_hours} uur)
Geef eerst 3-4 concrete dingen om TIJDENS de sessie te filmen (shot list als 'idea'), daarna 2-3 posts die ze ná de sessie uit dat materiaal halen. Elke post op een logische dag na de sessie.`
      : `Maak een CONTENTPLAN voor de week van ${weekStart} met precies ${goal} posts, verdeeld over de week. Mix formats (Reel/TikTok, carrousel, story, foto). Bouw naar eventuele geplande releases toe.`;

    const systemPrompt = `Je bent de Content Coach van Uprising Studio (Amersfoort). Je maakt concrete, vandaag-uitvoerbare contentplannen voor muzikanten met weinig bereik. Alles filmbaar met een telefoon. Nederlands.

${buildProfileBlock(profile)}

RECENTE CHECK-INS (wat werkte/niet):
${JSON.stringify(checkins || [])}

Belangrijk: hou rekening met hun tijdsbudget, comfort op camera en sterke kanten. Als ze camera-shy zijn, stel meer B-roll/tekst-over-beeld voor. Moedig aan om sessievideo's via de Uprising-app in te sturen (levert punten + wij delen het = extra bereik).

TAAK: ${task}

Antwoord UITSLUITEND met geldige JSON in exact dit formaat (geen tekst eromheen, geen markdown):
{"title":"korte titel","items":[{"day":"Maandag","format":"Reel","idea":"concreet idee, 1-2 zinnen","caption":"complete caption met hook","hashtags":"#tag1 #tag2 #tag3"}]}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed: { title?: string; items?: any[] };
    try {
      parsed = JSON.parse(raw.replace(/```json\s*|\s*```/g, "").trim());
    } catch {
      parsed = { title: mode === "session" ? "Sessieplan" : "Weekplan", items: [] };
    }

    const items = (Array.isArray(parsed.items) ? parsed.items : []).map((it, i) => ({
      id: `${Date.now()}-${i}`,
      day: String(it.day || "").slice(0, 40),
      format: String(it.format || "Post").slice(0, 40),
      idea: String(it.idea || "").slice(0, 600),
      caption: String(it.caption || "").slice(0, 800),
      hashtags: String(it.hashtags || "").slice(0, 300),
      done: false,
    }));

    const title = String(parsed.title || (mode === "session" ? "Sessieplan" : `Weekplan ${weekStart}`)).slice(0, 120);

    // Persist. Weekly plans are one-per-week (partial unique index), so replace
    // any existing weekly plan; session plans always insert.
    let planRow: any;
    if (mode === "weekly") {
      await admin
        .from("content_plans")
        .delete()
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .eq("source", "weekly");
      const { data: ins } = await admin
        .from("content_plans")
        .insert({
          user_id: userId, week_start: weekStart, title, items, source: "weekly",
        })
        .select("*")
        .single();
      planRow = ins;
    } else {
      const { data: ins } = await admin
        .from("content_plans")
        .insert({
          user_id: userId, week_start: weekStart, title, items,
          source: "session", booking_id: bookingId,
        })
        .select("*")
        .single();
      planRow = ins;
    }

    return new Response(JSON.stringify({ plan: planRow, existed: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Coach generate error:", e);
    return new Response(JSON.stringify({ error: "An internal error occurred." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
