ALTER TABLE atlas_control.sources ADD COLUMN listing_details_allowed boolean NOT NULL DEFAULT false;
CREATE TABLE public.atlas_saved_views (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id text NOT NULL,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),filters jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX atlas_saved_views_owner ON public.atlas_saved_views(owner_id,created_at DESC);
ALTER TABLE public.atlas_saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_views_own ON public.atlas_saved_views FOR ALL TO atlas_api
 USING(owner_id=current_setting('atlas.user_id',true)) WITH CHECK(owner_id=current_setting('atlas.user_id',true));
REVOKE ALL ON public.atlas_saved_views FROM PUBLIC;
GRANT SELECT,INSERT,DELETE ON public.atlas_saved_views TO atlas_api;
GRANT UPDATE(listing_details_allowed) ON atlas_control.sources TO atlas_api;
