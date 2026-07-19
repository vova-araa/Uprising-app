-- Track invoice reminders so the scheduler doesn't spam labels.
ALTER TABLE public.label_invoices
  ADD COLUMN last_reminder_at timestamptz,
  ADD COLUMN reminder_count integer NOT NULL DEFAULT 0;
