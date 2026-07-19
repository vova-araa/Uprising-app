// Label invoicing: generate a PDF invoice for an hour bundle (top-up term),
// store it in the private invoices bucket, optionally email the label a
// download link, and top up the shared pool when the invoice is marked paid.
//
// Actions (admin/staff only, except get_pdf which the label manager may use
// for their own invoices):
//   create     -> new draft invoice + PDF
//   send       -> email the label a download link, mark sent
//   mark_paid  -> mark paid + credit the pool with the hours
//   get_pdf    -> fresh signed download URL

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SIGNED_URL_DAYS = 30;

function euro(n: number): string {
  return `EUR ${n.toFixed(2).replace(".", ",")}`;
}

async function generateInvoicePdf(inv: {
  invoice_number: string;
  label_name: string;
  billing_address: string | null;
  vat_number: string | null;
  hours: number;
  rate: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  term: string | null;
  date: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const purple = rgb(0.55, 0.3, 0.9);
  const dark = rgb(0.12, 0.12, 0.16);
  const grey = rgb(0.45, 0.45, 0.5);
  let y = 800;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = dark) =>
    page.drawText(s, { x, y: yy, size, font: f, color });

  // Header
  text("UPRISING STUDIO", 40, y, 20, bold, purple);
  text("FACTUUR", 430, y, 20, bold, dark);
  y -= 22;
  text("Spaceshuttle 6E, 3824 ML Amersfoort", 40, y, 9, font, grey);
  text(inv.invoice_number, 430, y, 10, bold, grey);
  y -= 12;
  text("info@uprisingstudio.nl • uprisingstudio.nl", 40, y, 9, font, grey);
  text(inv.date, 430, y, 9, font, grey);

  y -= 46;
  // Bill to
  text("Factuur aan:", 40, y, 9, bold, grey);
  y -= 15;
  text(inv.label_name, 40, y, 12, bold, dark);
  if (inv.billing_address) {
    for (const line of inv.billing_address.split("\n").slice(0, 3)) {
      y -= 13;
      text(line, 40, y, 10, font, dark);
    }
  }
  if (inv.vat_number) {
    y -= 13;
    text(`BTW: ${inv.vat_number}`, 40, y, 9, font, grey);
  }

  // Table
  y -= 40;
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 22, color: rgb(0.95, 0.94, 0.98) });
  text("Omschrijving", 48, y, 10, bold, dark);
  text("Uren", 360, y, 10, bold, dark);
  text("Tarief", 420, y, 10, bold, dark);
  text("Bedrag", 495, y, 10, bold, dark);

  y -= 28;
  const desc = `Studio-uren tegoed${inv.term ? ` — ${inv.term}` : ""}`;
  text(desc, 48, y, 10);
  text(String(inv.hours), 360, y, 10);
  text(euro(inv.rate), 420, y, 10);
  text(euro(inv.subtotal), 490, y, 10);

  // Totals
  y -= 34;
  page.drawLine({ start: { x: 340, y: y + 12 }, end: { x: 555, y: y + 12 }, thickness: 0.6, color: grey });
  text("Subtotaal", 360, y, 10, font, grey);
  text(euro(inv.subtotal), 490, y, 10);
  y -= 16;
  text(`BTW ${inv.vat_rate}%`, 360, y, 10, font, grey);
  text(euro(inv.vat_amount), 490, y, 10);
  y -= 20;
  text("Totaal", 360, y, 12, bold, dark);
  text(euro(inv.total), 490, y, 12, bold, purple);

  // Footer
  text("Betaling binnen 14 dagen. Na ontvangst wordt het uren-tegoed van het label opgehoogd.", 40, 70, 9, font, grey);
  text("Bedankt voor de samenwerking — Uprising Studio", 40, 56, 9, font, grey);

  return await doc.save();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const { data: isStaff } = await admin.rpc("has_role", { _user_id: user.id, _role: "staff" });
    const staff = isAdmin === true || isStaff === true;

    const body = await req.json();
    const action = body.action || "create";

    // get_pdf: manager of the invoice's label OR staff
    if (action === "get_pdf") {
      const { data: invoice } = await admin.from("label_invoices").select("*").eq("id", body.invoice_id).single();
      if (!invoice?.pdf_path) return new Response(JSON.stringify({ error: "Geen PDF" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: isManager } = await admin.rpc("is_label_manager", { _user_id: user.id, _label_id: invoice.label_id });
      if (!staff && isManager !== true) return new Response(JSON.stringify({ error: "Geen toegang" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: signed } = await admin.storage.from("invoices").createSignedUrl(invoice.pdf_path, SIGNED_URL_DAYS * 86400);
      return new Response(JSON.stringify({ url: signed?.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // All mutating actions are staff-only
    if (!staff) return new Response(JSON.stringify({ error: "Geen admin rechten" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Manual hour correction on the pool (staff-only)
    if (action === "adjust_hours") {
      const h = Number(body.hours);
      if (!Number.isFinite(h) || h === 0) return new Response(JSON.stringify({ error: "Ongeldig aantal uren" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error: adjErr, data: newBal } = await admin.rpc("label_hours_apply", {
        p_label_id: body.label_id, p_hours: h, p_type: "admin_adjust", p_note: body.note || "Handmatige correctie",
      });
      if (adjErr) {
        const insufficient = String(adjErr.message || "").includes("insufficient");
        return new Response(JSON.stringify({ error: insufficient ? "Saldo kan niet negatief worden" : "Aanpassen mislukt" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true, hours_balance: newBal }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "create") {
      const { label_id, hours, rate, term, vat_rate } = body;
      const { data: label } = await admin.from("labels").select("*").eq("id", label_id).single();
      if (!label) return new Response(JSON.stringify({ error: "Label niet gevonden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const h = Number(hours);
      const r = Number(rate ?? label.default_rate);
      const vr = Number(vat_rate ?? 21);
      if (!(h > 0) || !(r >= 0)) return new Response(JSON.stringify({ error: "Ongeldige uren of tarief" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const subtotal = Math.round(h * r * 100) / 100;
      const vat_amount = Math.round(subtotal * vr) / 100;
      const total = Math.round((subtotal + vat_amount) * 100) / 100;

      // Invoice number: UPR-YYYY-#### (sequence within the year)
      const year = new Date().toISOString().slice(0, 4);
      const { count } = await admin.from("label_invoices").select("id", { count: "exact", head: true }).gte("created_at", `${year}-01-01`);
      const invoice_number = `UPR-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
      const dateStr = new Date().toLocaleDateString("nl-NL");

      const pdfBytes = await generateInvoicePdf({
        invoice_number, label_name: label.name, billing_address: label.billing_address,
        vat_number: label.vat_number, hours: h, rate: r, subtotal, vat_rate: vr, vat_amount, total,
        term: term || null, date: dateStr,
      });

      const pdf_path = `${label_id}/${invoice_number}.pdf`;
      const { error: upErr } = await admin.storage.from("invoices").upload(pdf_path, pdfBytes, { contentType: "application/pdf", upsert: true });
      if (upErr) { console.error("[LABEL-INVOICE] upload failed:", upErr); }

      const { data: invoice, error: insErr } = await admin.from("label_invoices").insert({
        label_id, invoice_number, hours: h, rate: r, subtotal, vat_rate: vr, vat_amount, total,
        term: term || null, status: "draft", pdf_path: upErr ? null : pdf_path, created_by: user.id,
      }).select("*").single();
      if (insErr) { console.error("[LABEL-INVOICE] insert failed:", insErr); return new Response(JSON.stringify({ error: "Factuur opslaan mislukt" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

      const { data: signed } = pdf_path ? await admin.storage.from("invoices").createSignedUrl(pdf_path, SIGNED_URL_DAYS * 86400) : { data: null };
      return new Response(JSON.stringify({ success: true, invoice, url: signed?.signedUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "send") {
      const { data: invoice } = await admin.from("label_invoices").select("*").eq("id", body.invoice_id).single();
      if (!invoice) return new Response(JSON.stringify({ error: "Factuur niet gevonden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: label } = await admin.from("labels").select("*").eq("id", invoice.label_id).single();
      const to = body.to || label?.contact_email;
      if (!to) return new Response(JSON.stringify({ error: "Geen e-mailadres voor dit label" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: signed } = invoice.pdf_path ? await admin.storage.from("invoices").createSignedUrl(invoice.pdf_path, SIGNED_URL_DAYS * 86400) : { data: null };
      const link = signed?.signedUrl || "";
      await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to,
          subject: `Factuur ${invoice.invoice_number} — Uprising Studio`,
          html: `<p>Beste ${label?.contact_name || label?.name || ""},</p>
<p>Bijgaand de factuur voor jullie studio-uren${invoice.term ? ` (${invoice.term})` : ""}.</p>
<p><strong>${invoice.hours} uur</strong> — totaal <strong>EUR ${Number(invoice.total).toFixed(2)}</strong> incl. ${invoice.vat_rate}% btw.</p>
${link ? `<p><a href="${link}">Download de factuur (PDF)</a></p>` : ""}
<p>Na ontvangst van de betaling hogen we het uren-tegoed van ${label?.name || "het label"} op.</p>
<p>Met vriendelijke groet,<br/>Uprising Studio</p>`,
          message_id: `label-invoice-${invoice.id}`,
          purpose: "transactional",
        },
      });

      await admin.from("label_invoices").update({ status: invoice.status === "paid" ? "paid" : "sent", sent_at: new Date().toISOString() }).eq("id", invoice.id);
      return new Response(JSON.stringify({ success: true, sent_to: to }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "mark_paid") {
      const { data: invoice } = await admin.from("label_invoices").select("*").eq("id", body.invoice_id).single();
      if (!invoice) return new Response(JSON.stringify({ error: "Factuur niet gevonden" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (invoice.status === "paid") return new Response(JSON.stringify({ error: "Factuur is al betaald" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Credit the pool with the invoiced hours
      const { error: poolErr } = await admin.rpc("label_hours_apply", {
        p_label_id: invoice.label_id,
        p_hours: Number(invoice.hours),
        p_type: "topup",
        p_note: `Factuur ${invoice.invoice_number} betaald`,
      });
      if (poolErr) { console.error("[LABEL-INVOICE] pool topup failed:", poolErr); return new Response(JSON.stringify({ error: "Pot ophogen mislukt" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

      await admin.from("label_invoices").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", invoice.id);

      const { data: label } = await admin.from("labels").select("hours_balance, name").eq("id", invoice.label_id).single();
      // Notify all managers of the label
      const { data: managers } = await admin.from("label_managers").select("user_id").eq("label_id", invoice.label_id);
      if (managers && managers.length > 0 && label) {
        await admin.from("notifications").insert(managers.map((m: { user_id: string }) => ({
          user_id: m.user_id,
          title: "Uren bijgeschreven 🎉",
          message: `${invoice.hours} uur is toegevoegd aan de pot van ${label.name}. Nieuw saldo: ${label.hours_balance} uur.`,
          type: "success",
          link: "/label",
        })));
      }
      return new Response(JSON.stringify({ success: true, hours_balance: label?.hours_balance }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Onbekende actie" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[LABEL-INVOICE] ERROR:", error);
    return new Response(JSON.stringify({ error: "Er ging iets mis" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
