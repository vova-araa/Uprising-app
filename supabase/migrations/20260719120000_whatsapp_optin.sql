-- WhatsApp notifications (via our own WhatsApp Business number, Meta Cloud
-- API). Opt-in per user; the number reuses profiles.phone (E.164).
ALTER TABLE public.profiles
  ADD COLUMN whatsapp_opt_in boolean NOT NULL DEFAULT false;
