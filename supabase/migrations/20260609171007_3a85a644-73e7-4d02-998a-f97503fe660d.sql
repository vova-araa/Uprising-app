
-- 1) Extend protect_booking_sensitive_fields to block session_type and notes
CREATE OR REPLACE FUNCTION public.protect_booking_sensitive_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN RETURN NEW; END IF;
  IF has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff') THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    RAISE EXCEPTION 'Cannot modify booking status';
  END IF;
  IF OLD.total_price IS DISTINCT FROM NEW.total_price THEN
    RAISE EXCEPTION 'Cannot modify total_price';
  END IF;
  IF OLD.stripe_session_id IS DISTINCT FROM NEW.stripe_session_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_session_id';
  END IF;
  IF OLD.studio_id IS DISTINCT FROM NEW.studio_id THEN
    RAISE EXCEPTION 'Cannot modify studio_id';
  END IF;
  IF OLD.duration_hours IS DISTINCT FROM NEW.duration_hours THEN
    RAISE EXCEPTION 'Cannot modify duration_hours';
  END IF;
  IF OLD.booking_date IS DISTINCT FROM NEW.booking_date THEN
    RAISE EXCEPTION 'Cannot modify booking_date';
  END IF;
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    RAISE EXCEPTION 'Cannot modify start_time';
  END IF;
  IF OLD.extras IS DISTINCT FROM NEW.extras THEN
    RAISE EXCEPTION 'Cannot modify extras';
  END IF;
  IF OLD.session_type IS DISTINCT FROM NEW.session_type THEN
    RAISE EXCEPTION 'Cannot modify session_type';
  END IF;
  IF OLD.notes IS DISTINCT FROM NEW.notes THEN
    RAISE EXCEPTION 'Cannot modify notes';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Restrictive storage policies: block non-admin writes to uploads/config/*
CREATE POLICY "Block non-admin writes to config folder (insert)"
ON storage.objects
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id <> 'uploads'
  OR (storage.foldername(name))[1] <> 'config'
  OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
);

CREATE POLICY "Block non-admin writes to config folder (update)"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id <> 'uploads'
  OR (storage.foldername(name))[1] <> 'config'
  OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
)
WITH CHECK (
  bucket_id <> 'uploads'
  OR (storage.foldername(name))[1] <> 'config'
  OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
);

CREATE POLICY "Block non-admin writes to config folder (delete)"
ON storage.objects
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (
  bucket_id <> 'uploads'
  OR (storage.foldername(name))[1] <> 'config'
  OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')
);

-- Allow admin/staff to insert/update/delete in uploads/config/*
CREATE POLICY "Admins can manage config uploads (insert)"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'config'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Admins can manage config uploads (update)"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'config'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
)
WITH CHECK (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'config'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Admins can manage config uploads (delete)"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'config'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
);
