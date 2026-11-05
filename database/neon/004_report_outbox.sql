ALTER TABLE public.atlas_reports ADD COLUMN storage_state text NOT NULL DEFAULT 'ready' CHECK(storage_state IN ('pending','ready'));
CREATE TABLE atlas_control.object_deletions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket text NOT NULL CHECK(bucket IN ('assets','atlasraw')),
 object_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bucket,object_key)
);
GRANT INSERT ON atlas_control.object_deletions TO atlas_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON atlas_control.object_deletions TO atlas_worker;
GRANT UPDATE(title,storage_state) ON public.atlas_reports TO atlas_api;
-- Cleanup is a narrowly scoped definer function; the worker cannot read users' reports.
CREATE FUNCTION atlas_control.expire_pending_reports() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,atlas_control AS $$
DECLARE n integer; BEGIN
 WITH expired AS(DELETE FROM public.atlas_reports WHERE storage_state='pending' AND created_at<now()-interval '1 hour' RETURNING object_key)
 INSERT INTO atlas_control.object_deletions(bucket,object_key) SELECT 'assets',object_key FROM expired ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION atlas_control.expire_pending_reports() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atlas_control.expire_pending_reports() TO atlas_worker;
