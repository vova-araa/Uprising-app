
-- Make booking_id nullable so unlimited access doesn't need a fake booking
ALTER TABLE public.booking_access ALTER COLUMN booking_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE public.booking_access DROP CONSTRAINT IF EXISTS booking_access_booking_id_fkey;

-- Re-add with ON DELETE SET NULL for nullable reference
ALTER TABLE public.booking_access ADD CONSTRAINT booking_access_booking_id_fkey 
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;
