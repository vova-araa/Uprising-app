ALTER TABLE bookings DISABLE TRIGGER USER;
UPDATE bookings SET status = 'confirmed' WHERE id = 'c6d1eb43-2e9a-49a1-a692-7aeb69c519d4' AND status = 'pending';
ALTER TABLE bookings ENABLE TRIGGER USER;