-- Enable RLS on realtime.messages (safe if already enabled)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present
DROP POLICY IF EXISTS "Users can subscribe to own channels" ON realtime.messages;
DROP POLICY IF EXISTS "Admins can subscribe to all channels" ON realtime.messages;

-- Authenticated users may only access channels prefixed with their own uid
CREATE POLICY "Users can subscribe to own channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = ('user:' || auth.uid()::text)
  OR realtime.topic() LIKE ('private:' || auth.uid()::text || ':%')
);

-- Admins/staff can access all channels (e.g. global admin notifications stream)
CREATE POLICY "Admins can subscribe to all channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
);