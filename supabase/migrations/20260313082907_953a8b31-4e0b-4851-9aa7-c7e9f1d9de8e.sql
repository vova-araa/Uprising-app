ALTER TABLE profiles ADD COLUMN studio1_hours integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN studio2_hours integer NOT NULL DEFAULT 0;
-- Migrate existing studio_hours to studio1_hours (keep as default)
UPDATE profiles SET studio1_hours = studio_hours WHERE studio_hours > 0;
-- Drop old column
ALTER TABLE profiles DROP COLUMN studio_hours;