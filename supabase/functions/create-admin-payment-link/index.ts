import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify admin role
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "staff" });
    if (!isAdmin && !isStaff) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { booking_id, customer_id, studio_id, booking_date, start_time, duration_hours, total_price } = body;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const studioNames: Record<string, string> = {
      "studio-1": "Studio 1",
      "studio-2": "Studio 2",
      "content-room": "Content Room",
    };

    let customerEmail: string | undefined;
    let customerName: string | undefined;
    let sessionName: string;
    let amount: number;

    if (booking_id) {
      // Existing booking flow
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", booking_id)
        .single();

      if (bookingError || !booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (booking.total_price <= 0) {
        return new Response(JSON.stringify({ error: "Booking has no cost" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", booking.user_id)
        .single();

      customerEmail = profile?.email || undefined;
      customerName = profile?.full_name || undefined;
      const studioName = studioNames[booking.studio_id] || booking.studio_id;
      sessionName = `${studioName} - ${booking.booking_date} ${booking.start_time} (${booking.duration_hours}h)`;
      amount = Math.round(booking.total_price * 100);
    } else {
      // Pre-booking flow: generate link before booking exists
      if (!customer_id || !studio_id || !total_price || total_price <= 0) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email, full_name")
        .eq("id", customer_id)
        .single();

      customerEmail = profile?.email || undefined;
      customerName = profile?.full_name || undefined;
      const studioName = studioNames[studio_id] || studio_id;
      sessionName = `${studioName} - ${booking_date || "TBD"} ${start_time || ""} (${duration_hours || "?"}h)`;
      amount = Math.round(total_price * 100);
    }

    // Check for existing Stripe customer
    let stripeCustomerId: string | undefined;
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) stripeCustomerId = customers.data[0].id;
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : customerEmail || undefined,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: sessionName },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: "payment",
      payment_method_types: ["card", "ideal"],
      success_url: `${Deno.env.get("APP_URL") || "https://app.uprisingstudio.nl"}/account?payment=success&tab=bookings`,
      cancel_url: `${Deno.env.get("APP_URL") || "https://app.uprisingstudio.nl"}/book?payment=cancelled`,

      metadata: {
        booking_id: booking_id || "",
        user_id: customer_id || "",
        type: "admin-payment-link",
      },
    });

    // If booking exists, store session id
    if (booking_id) {
      await supabaseAdmin
        .from("bookings")
        .update({ stripe_session_id: session.id })
        .eq("id", booking_id);
    }

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ADMIN-PAYMENT-LINK] ERROR:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
