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

Wees vriendelijk, behulpzaam en direct. Geef concrete aanbevelingen. Als de taal Engels is, antwoord in het Engels.`;

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

    const systemPrompt = lang === "en"
      ? SYSTEM_PROMPT + "\n\nThe user prefers English. Respond in English."
      : SYSTEM_PROMPT;

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
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
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
