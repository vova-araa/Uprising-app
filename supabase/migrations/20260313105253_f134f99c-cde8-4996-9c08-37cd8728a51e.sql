
-- Revoke SELECT on staff_notes from authenticated role to prevent regular users from reading internal admin notes
REVOKE SELECT (staff_notes) ON public.content_requests FROM authenticated;
REVOKE SELECT (staff_notes) ON public.projects FROM authenticated;
