-- Multi-client membership + super_admin role
-- Apply with: psql or npm run db:push after reviewing.

-- 1) Extend role enum (safe if value already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'trak_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE trak_role ADD VALUE 'super_admin' BEFORE 'admin';
  END IF;
END$$;

-- 2) Engagement client membership
CREATE TABLE IF NOT EXISTS engagement_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS engagement_clients_engagement_idx ON engagement_clients(engagement_id);
CREATE INDEX IF NOT EXISTS engagement_clients_user_idx ON engagement_clients(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS engagement_clients_unique ON engagement_clients(engagement_id, user_id);

-- 3) Backfill primary clients as owners
INSERT INTO engagement_clients (engagement_id, user_id, member_role)
SELECT e.id, e.client_user_id, 'owner'
FROM engagements e
WHERE e.client_user_id IS NOT NULL
ON CONFLICT DO NOTHING;
