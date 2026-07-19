ALTER TABLE bookings DISABLE TRIGGER prevent_booking_status_change;
ALTER TABLE bookings DISABLE TRIGGER prevent_status_change_bookings;
UPDATE bookings SET status = 'confirmed', updated_at = now() WHERE status = 'pending' AND studio_id IN ('studio-a', 'studio-c', 'content-room');
ALTER TABLE bookings ENABLE TRIGGER prevent_booking_status_change;
ALTER TABLE bookings ENABLE TRIGGER prevent_status_change_bookings;