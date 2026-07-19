-- Schedule the booking-scheduler edge function every 10 minutes via pg_cron +
-- pg_net. The anon key is used as bearer (it is public by design); the
-- function itself only performs idempotent, time-gated maintenance and
-- rejects requests without a known key.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'booking-scheduler-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rwjpgwgeosrldramrgvq.supabase.co/functions/v1/booking-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3anBnd2dlb3NybGRyYW1yZ3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzcxMjcsImV4cCI6MjA4ODc1MzEyN30.vSbBH3ss1Cus3YDTsTp2150-VbEhtnP3logIquN9EF8"}'::jsonb,
    body := '{"source": "pg_cron"}'::jsonb
  );
  $$
);
