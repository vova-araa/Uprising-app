import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { notifyZapierBooking, STUDIO_LABELS } from "../_shared/zapier.ts";
import { provisionBookingAccess } from "../_shared/nuki.ts";
import { maybeGenerateSessionPlan } from "../_shared/coach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { session_id, type } = await req.json();
    if (!session_id) throw new Error("No session_id provided");

    logStep("Verifying payment", { session_id, type, userId: user.id });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Verify payment was actually completed
    if (session.payment_status !== "paid") {
      logStep("Payment not completed", { status: session.payment_status });
      return new Response(JSON.stringify({ verified: false, error: "Payment not completed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify this session belongs to this user
    if (session.metadata?.user_id !== user.id) {
      logStep("User mismatch", { sessionUser: session.metadata?.user_id, requestUser: user.id });
      return new Response(JSON.stringify({ verified: false, error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Payment verified", { type: session.metadata?.type, amount: session.amount_total });

    const paymentType = session.metadata?.type || type;

    // Handle membership: sync to profile
    if (paymentType === "membership") {
      const plan = session.metadata?.plan;
      if (plan) {
        const isBroedplaats = plan.startsWith("broedplaats");
        const updateField = isBroedplaats ? "broedplaats" : "membership";
        await supabaseAdmin
          .from("profiles")
          .update({ [updateField]: plan, updated_at: new Date().toISOString() })
          .eq("id", user.id);
        logStep("Membership synced to profile", { plan, field: updateField });
      }

      return new Response(JSON.stringify({ verified: true, type: "membership", plan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle producer-session: mark booking as paid
    if (paymentType === "producer-session") {
      const { data: pendingProducer } = await supabaseAdmin
        .from("producer_bookings")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending")
        .is("stripe_session_id", null)
        .order("created_at", { ascending: false })
        .limit(1);

      if (pendingProducer && pendingProducer.length > 0) {
        await supabaseAdmin
          .from("producer_bookings")
          .update({ stripe_session_id: session_id })
          .eq("id", pendingProducer[0].id);
        logStep("Producer booking marked as paid", { bookingId: pendingProducer[0].id });

        // Notify admins about producer session
        const { data: prof } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
        const pName = prof?.full_name || prof?.email || "Onbekend";
        const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
        if (admins && admins.length > 0) {
          await supabaseAdmin.from("notifications").insert(
            admins.map((r: any) => ({
              user_id: r.user_id,
              title: "Nieuwe Producer Session",
              message: `${pName} heeft een Producer Session geboekt en betaald.`,
              type: "info",
              link: "/admin",
            }))
          );
        }

        // Fetch producer booking details for Zapier
        const { data: pb } = await supabaseAdmin
          .from("producer_bookings")
          .select("preferred_date, preferred_time")
          .eq("id", pendingProducer[0].id)
          .single();
        if (pb) {
          await notifyZapierBooking({
            naam: pName,
            email: prof?.email ?? "",
            datum: pb.preferred_date,
            tijd: pb.preferred_time,
            studio: "Producer Session",
            type: "producer",
            source: "verify-payment",
          });
        }
      }
    }

    // Handle mix-master: create project
    if (paymentType === "mix-master") {
      const { data: existing } = await supabaseAdmin
        .from("projects")
        .select("id")
        .eq("stripe_session_id", session_id)
        .limit(1);

      if (!existing || existing.length === 0) {
        const trackCount = parseInt(session.metadata?.track_count || "1");
        const price = (session.amount_total || 0) / 100;

        await supabaseAdmin.from("projects").insert({
          user_id: user.id,
          title: `Mix & Master - ${trackCount} ${trackCount === 1 ? "track" : "tracks"}`,
          description: session.metadata?.description || null,
          style: session.metadata?.style || null,
          reference_links: session.metadata?.reference ? [session.metadata.reference] : null,
          price,
          status: "received",
          stripe_session_id: session_id,
        });
        logStep("Mix & Master project created");

        // Notify admins about mix & master
        const { data: prof } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
        const mName = prof?.full_name || prof?.email || "Onbekend";
        const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
        if (admins && admins.length > 0) {
          await supabaseAdmin.from("notifications").insert(
            admins.map((r: any) => ({
              user_id: r.user_id,
              title: "Nieuw Mix & Master project",
              message: `${mName} heeft een Mix & Master project aangevraagd (${trackCount} tracks, €${price}).`,
              type: "info",
              link: "/admin",
            }))
          );
        }
      }
    }

    // Handle studio booking: confirm pending_payment booking
    if (paymentType === "studio-booking" || !paymentType) {
      // Match by stripe_session_id first for precision, fallback to latest pending
      const bookingId = session.metadata?.booking_id;
      let pendingBookings: any[] = [];

      if (bookingId) {
        const { data } = await supabaseAdmin
          .from("bookings")
          .select("id, studio_id, stripe_session_id")
          .eq("id", bookingId)
          .eq("status", "pending_payment")
          .limit(1);
        pendingBookings = data || [];
      }

      if (pendingBookings.length === 0) {
        const { data } = await supabaseAdmin
          .from("bookings")
          .select("id, studio_id, stripe_session_id")
          .eq("user_id", user.id)
          .eq("status", "pending_payment")
          .order("created_at", { ascending: false })
          .limit(1);
        pendingBookings = data || [];
      }

      if (pendingBookings && pendingBookings.length > 0) {
        const b = pendingBookings[0];
        await supabaseAdmin
          .from("bookings")
          .update({ status: "confirmed", stripe_session_id: session_id, updated_at: new Date().toISOString() })
          .eq("id", b.id);

        // Fetch booking details for notification
        const { data: bookingDetails } = await supabaseAdmin
          .from("bookings")
          .select("studio_id, booking_date, start_time")
          .eq("id", b.id)
          .single();

        if (bookingDetails) {
          const studioName: Record<string, string> = { "studio-1": "Studio 1", "studio-2": "Studio 2", "content-room": "Content Room" };
          await supabaseAdmin.from("notifications").insert({
            user_id: user.id,
            title: "Boeking bevestigd!",
            message: `Je ${studioName[bookingDetails.studio_id] || bookingDetails.studio_id} sessie op ${bookingDetails.booking_date} om ${bookingDetails.start_time} is bevestigd.`,
            type: "success",
            link: "/account?tab=bookings",
          });

          // Notify admins
          const { data: profile } = await supabaseAdmin.from("profiles").select("full_name, email").eq("id", user.id).single();
          const userName = profile?.full_name || profile?.email || "Onbekend";
          const { data: adminRoles } = await supabaseAdmin.from("user_roles").select("user_id").in("role", ["admin", "staff"]);
          if (adminRoles && adminRoles.length > 0) {
            await supabaseAdmin.from("notifications").insert(
              adminRoles.map((r: any) => ({
                user_id: r.user_id,
                title: "Nieuwe betaalde boeking",
                message: `${userName} heeft ${studioName[bookingDetails.studio_id] || bookingDetails.studio_id} geboekt op ${bookingDetails.booking_date} om ${bookingDetails.start_time} (betaald).`,
                type: "info",
                link: "/admin?tab=calendar",
              }))
            );
          }

          await notifyZapierBooking({
            naam: userName,
            email: profile?.email ?? user.email ?? "",
            datum: bookingDetails.booking_date,
            tijd: bookingDetails.start_time,
            studio: STUDIO_LABELS[bookingDetails.studio_id] || bookingDetails.studio_id,
            type: "studio",
            source: "verify-payment",
          });
        }

        // Auto-provision booking-scoped door access (app-based front-door unlock)
        const provision = await provisionBookingAccess(supabaseAdmin, b.id);
        if (!provision.ok) {
          logStep("Nuki provisioning failed", { bookingId: b.id, reason: provision.reason });
        }

        // Coach users: auto-generate a session shot list + post plan
        await maybeGenerateSessionPlan(supabaseAdmin, b.id, user.id);

        logStep("Studio booking confirmed", { bookingId: b.id });
      }
    }

    return new Response(JSON.stringify({ verified: true, type: paymentType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ verified: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
