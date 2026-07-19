import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is authorized (service role or matching cron secret)
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Only allow service role key or the anon key from cron (validate via x-cron-key header)
    const isServiceRole = token === serviceRoleKey;
    const isCronCall = req.headers.get("x-cron-key") === serviceRoleKey;
    
    if (!isServiceRole && !isCronCall) {
      // Check if caller is admin
      const supabaseCheck = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claims, error: claimsError } = await supabaseCheck.auth.getUser();
      if (claimsError || !claims?.user) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabaseCheck.rpc("has_role", {
        _user_id: claims.user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Get all confirmed/pending bookings for today and tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("*")
      .in("booking_date", [todayStr, tomorrowStr])
      .in("status", ["confirmed", "pending"]);

    if (error) throw error;
    if (!bookings || bookings.length === 0) {
      return new Response(JSON.stringify({ message: "No bookings to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let notificationsSent = 0;

    // Fetch notification preferences for all relevant users
    const userIds = [...new Set(bookings.map(b => b.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, notification_prefs")
      .in("id", userIds);
    const prefsMap: Record<string, any> = {};
    for (const p of profilesData || []) {
      prefsMap[p.id] = p.notification_prefs || {};
    }

    for (const booking of bookings) {
      // Skip if user has disabled booking reminders
      const userPrefs = prefsMap[booking.user_id] || {};
      if (userPrefs.bookingReminders === false) continue;
      const sent = booking.notifications_sent || {};
      const bookingDate = booking.booking_date;
      const startHour = parseInt(booking.start_time.split(":")[0]);
      const startMin = parseInt(booking.start_time.split(":")[1] || "0");
      const endHour = startHour + booking.duration_hours;

      // Build datetime objects for this booking
      const sessionStart = new Date(`${bookingDate}T${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}:00`);
      const sessionEnd = new Date(sessionStart.getTime() + booking.duration_hours * 60 * 60 * 1000);
      const oneHourBefore = new Date(sessionStart.getTime() - 60 * 60 * 1000);
      const fifteenMinBefore = new Date(sessionEnd.getTime() - 15 * 60 * 1000);

      const notifications: { key: string; time: Date; title_nl: string; title_en: string; msg_nl: string; msg_en: string; type: string; link: string | null }[] = [
        {
          key: "1h_before",
          time: oneHourBefore,
          title_nl: "⏰ Sessie over 1 uur",
          title_en: "⏰ Session in 1 hour",
          msg_nl: `Je sessie begint om ${booking.start_time}. Vergeet niet op tijd te komen!`,
          msg_en: `Your session starts at ${booking.start_time}. Don't forget to arrive on time!`,
          type: "info",
          link: "/account",
        },
        {
          key: "session_start",
          time: sessionStart,
          title_nl: "🎵 Sessie gestart!",
          title_en: "🎵 Session started!",
          msg_nl: `Je sessie is nu begonnen. Veel succes en plezier!`,
          msg_en: `Your session has started. Good luck and have fun!`,
          type: "success",
          link: null,
        },
        {
          key: "15min_before_end",
          time: fifteenMinBefore,
          title_nl: "⚡ Nog 15 minuten",
          title_en: "⚡ 15 minutes left",
          msg_nl: `Je sessie eindigt over 15 minuten. Begin met afronden!`,
          msg_en: `Your session ends in 15 minutes. Start wrapping up!`,
          type: "warning",
          link: null,
        },
        {
          key: "session_end",
          time: sessionEnd,
          title_nl: "✅ Sessie afgelopen",
          title_en: "✅ Session ended",
          msg_nl: `Je sessie is afgelopen. Bedankt voor je bezoek! Laat een review achter.`,
          msg_en: `Your session has ended. Thanks for visiting! Leave a review.`,
          type: "info",
          link: `/feedback/${booking.id}`,
        },
      ];

      for (const notif of notifications) {
        if (sent[notif.key]) continue;

        // Check if the notification time has passed (within a 5-minute window)
        const diffMs = now.getTime() - notif.time.getTime();
        if (diffMs >= 0 && diffMs < 5 * 60 * 1000) {
          // Send notification
          await supabase.from("notifications").insert({
            user_id: booking.user_id,
            title: notif.title_nl,
            message: notif.msg_nl,
            type: notif.type,
            link: notif.link,
          });

          // Mark as sent
          sent[notif.key] = true;
          notificationsSent++;
        }
      }

      // Update notifications_sent if changed
      if (Object.keys(sent).length > Object.keys(booking.notifications_sent || {}).length) {
        await supabase
          .from("bookings")
          .update({ notifications_sent: sent })
          .eq("id", booking.id);
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${bookings.length} bookings, sent ${notificationsSent} notifications` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
