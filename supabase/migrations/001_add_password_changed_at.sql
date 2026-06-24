-- Add password_changed_at column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

-- Set initial value for existing users (so they're not forced to change immediately)
UPDATE profiles SET password_changed_at = created_at WHERE password_changed_at IS NULL;
