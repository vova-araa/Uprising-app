// Content-coach: an AI coach for artists/producers with little reach. Uses
// the member's intake (creator_profiles) plus their recent/upcoming sessions
// to give concrete post ideas, captions, shot lists and release plans — and
// keeps building from where they are in the process.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BASE_PROMPT = `Je bent de Content Coach van Uprising Studio in Amersfoort — een ervaren social media strateeg voor muzikanten, producers en creators die nog weinig bereik hebben.

JOUW STIJL:
- Direct, energiek, praktisch. Geen vage marketingpraat.
- Alles wat je voorstelt is vandaag uitvoerbaar met een telefoon.
- Kort waar het kan: liever 3 sterke ideeën dan 10 matige.
- Nederlands, tenzij de gebruiker Engels praat.

WAT JE DOET:
1. POST-IDEEËN: concrete content-ideeën passend bij hun genre, fase en sessies (bijv. "film 15 sec van je hook + tekst erover heen: 'dag 3 werken aan mijn eerste EP'").
2. CAPTIONS: schrijf 2-3 varianten per post (hook eerst, dan context, dan call-to-action), met passende hashtag-suggesties.
3. SHOT LISTS voor studiosessies: wat moeten ze filmen tijdens hun sessie (POV-shots, over-de-schouder bij de knoppen, reactie-shots, before/after audio).
4. RELEASE-ROLLOUT: van 3 weken voor release tot 1 week erna, welke content wanneer.
5. PROCES-COACHING: help ze van hun huidige fase naar de volgende (idee → opnemen → mixen → release → promo).

UPRISING CONTEXT:
- In de app kunnen ze hun sessievideo insturen: goedgekeurd = 50 punten én Uprising deelt het op hun socials (extra bereik + tag). Moedig dit aan waar relevant.
- Studio's zijn 24/7 boekbaar; de Content Room heeft camera, LED panels, green screen, teleprompter en podcast-setup — ideaal voor content-dagen.
- Mix & Master en producer-sessies zijn te boeken voor wie verder wil.

Gebruik het profiel van de gebruiker hieronder actief: verwijs naar hun naam, genre, doelen en fase. Als er geplande releases zijn, bouw daar naartoe. Vier behaalde mijlpalen.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, lang } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("API key not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Profile + session context for a personal answer
    const { data: profile } = await supabaseAdmin
      .from("creator_profiles").select("*").eq("user_id", user.id).maybeSingle();

    const today = new Date().toISOString().split("T")[0];
    const { data: upcoming } = await supabaseAdmin
      .from("bookings")
      .select("studio_id, booking_date, start_time, duration_hours")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .gte("booking_date", today)
      .order("booking_date", { ascending: true })
      .limit(3);
    const { data: recent } = await supabaseAdmin
      .from("bookings")
      .select("studio_id, booking_date, duration_hours")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .lt("booking_date", today)
      .order("booking_date", { ascending: false })
      .limit(3);

    // Recent check-ins so advice adapts to what actually worked
    const { data: checkins } = await supabaseAdmin
      .from("coach_checkins")
      .select("posted, reflection, reach_note, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const profileBlock = profile ? `
PROFIEL VAN DEZE GEBRUIKER:
- Artiestennaam: ${profile.artist_name || "onbekend"}
- Genre: ${profile.genre || "onbekend"}
- Merk/verhaal: ${profile.brand_description || "-"}
- Doelgroep: ${profile.target_audience || "-"}
- Doelen: ${profile.goals || "nog niet ingevuld"}
- Fase in het proces: ${profile.process_stage}
- Socials: ${JSON.stringify(profile.socials)} (totaal ±${profile.followers_total ?? "?"} volgers)
- Post vooral op: ${(profile.posting_platforms || []).join(", ") || "onbekend"}
- Tijdsbudget content: ${profile.time_budget || "-"} | Geldbudget promo: ${profile.money_budget || "-"}
- Comfort op camera: ${profile.camera_comfort || "-"}
- Sterke kanten: ${profile.strengths || "-"} | Worstelt met: ${profile.struggles || "-"}
- Releases tot nu toe: ${profile.releases || "nog niets uitgebracht"}
- Referentie-artiesten: ${profile.reference_artists || "-"}
- Releaseplanning: ${JSON.stringify(profile.release_plan)}
- Content-doel: ${profile.weekly_content_goal ?? "?"} posts per week
- Behaalde mijlpalen: ${JSON.stringify(profile.milestones)}

Pas je advies aan op hun tijdsbudget, camera-comfort en sterke kanten. Camera-shy? Zet in op B-roll en tekst-over-beeld.` : "\nPROFIEL: nog geen intake ingevuld — stel bij het eerste antwoord kort 2-3 intakevragen (genre, doel, waar ze staan) en geef daarna alvast één concreet idee.";

    const sessionsBlock = `
SESSIES:
- Komende sessies: ${JSON.stringify(upcoming || [])}
- Recente sessies: ${JSON.stringify(recent || [])}
RECENTE CHECK-INS (wat werkte/niet — leer hiervan):
${JSON.stringify(checkins || [])}`;

    const systemPrompt = BASE_PROMPT + profileBlock + sessionsBlock
      + (lang === "en" ? "\n\nThe user prefers English. Respond in English." : "");

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
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits op, neem contact op met de studio." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Content coach error:", e);
    return new Response(
      JSON.stringify({ error: "An internal error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
