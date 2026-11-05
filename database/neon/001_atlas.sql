BEGIN;
CREATE TABLE IF NOT EXISTS public.stg_kenya_listings (
  listing_id text PRIMARY KEY,
  county text NOT NULL,
  neighbourhood text NOT NULL,
  property_type text NOT NULL,
  listing_price_ksh numeric NOT NULL CHECK (listing_price_ksh >= 0),
  asking_rent_ksh numeric CHECK (asking_rent_ksh >= 0),
  size_sqft numeric CHECK (size_sqft > 0),
  bedrooms integer CHECK (bedrooms >= 0),
  source text NOT NULL,
  extracted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.atlas_reports (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  object_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS atlas_reports_owner_created ON public.atlas_reports(owner_id, created_at DESC);
-- Application access is exclusively through handlers that verify the user JWT.
REVOKE ALL ON public.atlas_reports FROM PUBLIC;
COMMIT;
