// Fire the session-plan generator for a confirmed booking, but only when the
// user has a creator profile (i.e. they use the coach). Non-blocking: uses
// EdgeRuntime.waitUntil when available so it never delays booking confirmation,
// and never throws into the caller.

interface SupabaseAdminLike {
  from: (table: string) => any;
}

export async function maybeGenerateSessionPlan(
  supabaseAdmin: SupabaseAdminLike,
  bookingId: string,
  userId: string,
): Promise<void> {
  try {
    const { data: profile } = await supabaseAdmin
      .from("creator_profiles").select("user_id").eq("user_id", userId).maybeSingle();
    if (!profile) return; // not a coach user — nothing to do

    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/coach-generate`;
    const call = fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ mode: "session", booking_id: bookingId, user_id: userId }),
    }).then(async () => {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: "Je sessieplan staat klaar 🎬",
        message: "De Content Coach heeft een shot list + postplan voor je sessie gemaakt. Bekijk 'm en film de juiste shots!",
        type: "success",
        link: "/coach",
      });
    }).catch((e) => console.error("[COACH] session plan generation failed:", e));

    // @ts-ignore — EdgeRuntime is available in Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(call);
    } else {
      await call;
    }
  } catch (e) {
    console.error("[COACH] maybeGenerateSessionPlan error:", e);
  }
}
