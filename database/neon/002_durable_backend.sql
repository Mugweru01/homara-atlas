CREATE SCHEMA atlas_control;
CREATE SCHEMA atlas_core;
CREATE SCHEMA atlas_mart;
CREATE SCHEMA atlas_security;
DO $$ BEGIN
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='atlas_api') THEN CREATE ROLE atlas_api NOLOGIN; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='atlas_worker') THEN CREATE ROLE atlas_worker NOLOGIN; END IF;
END $$;
CREATE TABLE atlas_control.sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL CHECK(slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 driver text NOT NULL CHECK(driver IN ('manual_listings','worldbank_wdi','geoboundaries_ken')),
 data_kind text NOT NULL CHECK(data_kind IN ('listings','context','geography')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','disabled','revoked')),
 license text NOT NULL CHECK(length(license) BETWEEN 1 AND 200), permission_url text NOT NULL CHECK(permission_url ~ '^https://'),
 attribution text NOT NULL CHECK(length(attribution) BETWEEN 1 AND 1000), approved_at timestamptz, approved_by text,
 rights_expire_at timestamptz, publication_allowed boolean NOT NULL DEFAULT false,
 refresh_seconds integer NOT NULL DEFAULT 86400 CHECK(refresh_seconds BETWEEN 3600 AND 2592000),
 next_run_at timestamptz NOT NULL DEFAULT now(), last_success_at timestamptz,
 watermark jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status <> 'active' OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)),
 CHECK((driver='manual_listings' AND data_kind='listings') OR (driver='worldbank_wdi' AND data_kind='context') OR (driver='geoboundaries_ken' AND data_kind='geography'))
);
CREATE TABLE atlas_control.jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES atlas_control.sources,
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 160),
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','retry','succeeded','failed','blocked')),
 requested_by text NOT NULL, payload jsonb, attempts integer NOT NULL DEFAULT 0,
 max_attempts integer NOT NULL DEFAULT 3 CHECK(max_attempts BETWEEN 1 AND 5), next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid, lease_expires_at timestamptz, received_count integer NOT NULL DEFAULT 0,
 accepted_count integer NOT NULL DEFAULT 0, rejected_count integer NOT NULL DEFAULT 0, duplicate_count integer NOT NULL DEFAULT 0,
 parser_version text NOT NULL DEFAULT 'atlas/1', error_code text,
 created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, finished_at timestamptz,
 UNIQUE(source_id,idempotency_key), CHECK((status='running')=(lease_token IS NOT NULL AND lease_expires_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_running_job_per_source ON atlas_control.jobs(source_id) WHERE status='running';
CREATE INDEX jobs_claim ON atlas_control.jobs(next_attempt_at,created_at) WHERE status IN ('queued','retry');
CREATE TABLE atlas_control.artifacts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES atlas_control.sources,
 sha256 text NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'), object_key text NOT NULL UNIQUE,
 byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 8388608), source_url text,
 retrieved_at timestamptz NOT NULL DEFAULT now(), UNIQUE(source_id,sha256)
);
CREATE TABLE atlas_control.job_artifacts (
 job_id uuid NOT NULL REFERENCES atlas_control.jobs, artifact_id uuid NOT NULL REFERENCES atlas_control.artifacts,
 PRIMARY KEY(job_id,artifact_id)
);
CREATE TABLE atlas_control.quality_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES atlas_control.jobs,
 item_key text NOT NULL, codes text[] NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id,item_key)
);
CREATE TABLE atlas_control.audit_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text NOT NULL, action text NOT NULL, resource_id text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE atlas_core.locations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES atlas_control.sources,
 source_key text NOT NULL, name text NOT NULL, kind text NOT NULL CHECK(kind IN ('country','county','neighbourhood')),
 parent_id uuid REFERENCES atlas_core.locations, UNIQUE(source_id,source_key)
);
CREATE TABLE atlas_core.location_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), location_id uuid NOT NULL REFERENCES atlas_core.locations,
 artifact_id uuid NOT NULL REFERENCES atlas_control.artifacts, revision_key text NOT NULL,
 reference_year integer CHECK(reference_year BETWEEN 1900 AND 2100), geometry jsonb, observed_at timestamptz NOT NULL,
 UNIQUE(location_id,revision_key)
);
CREATE TABLE atlas_core.location_aliases (
 source_id uuid NOT NULL REFERENCES atlas_control.sources, alias text NOT NULL,
 location_id uuid NOT NULL REFERENCES atlas_core.locations, PRIMARY KEY(source_id,alias)
);
CREATE TABLE atlas_core.properties (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE atlas_core.source_listings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES atlas_control.sources,
 source_listing_id text NOT NULL CHECK(length(source_listing_id) BETWEEN 1 AND 160), property_id uuid REFERENCES atlas_core.properties,
 first_seen_at timestamptz NOT NULL, last_seen_at timestamptz NOT NULL, UNIQUE(source_id,source_listing_id)
);
CREATE TABLE atlas_core.listing_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), listing_id uuid NOT NULL REFERENCES atlas_core.source_listings,
 job_id uuid NOT NULL REFERENCES atlas_control.jobs, artifact_id uuid NOT NULL REFERENCES atlas_control.artifacts,
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'), observed_at timestamptz NOT NULL,
 source_updated_at timestamptz, source_url text NOT NULL CHECK(source_url ~ '^https://'),
 listing_type text NOT NULL CHECK(listing_type IN ('sale','rent')),
 property_type text NOT NULL CHECK(property_type IN ('apartment','house','land','office','retail','warehouse')),
 county_id uuid NOT NULL REFERENCES atlas_core.locations, neighbourhood text,
 bedrooms smallint CHECK(bedrooms BETWEEN 0 AND 30), price_amount numeric(18,2) NOT NULL CHECK(price_amount>0),
 currency text NOT NULL CHECK(currency='KES'), rent_period text CHECK(rent_period IN ('month','week','day')),
 floor_area_sqm numeric(14,4) CHECK(floor_area_sqm>0), plot_area_sqm numeric(16,4) CHECK(plot_area_sqm>0),
 availability text NOT NULL CHECK(availability IN ('active','withdrawn','sold','let','unknown')),
 status_evidence text NOT NULL CHECK(status_evidence IN ('advertisement','provider_confirmation')),
 ingested_at timestamptz NOT NULL DEFAULT now(), UNIQUE(listing_id,observed_at,content_hash),
 CHECK((listing_type='rent' AND rent_period IS NOT NULL) OR (listing_type='sale' AND rent_period IS NULL)),
 CHECK(availability NOT IN ('sold','let') OR status_evidence='provider_confirmation')
);
CREATE INDEX observations_latest ON atlas_core.listing_observations(listing_id,observed_at DESC,ingested_at DESC);
CREATE INDEX observations_segment ON atlas_core.listing_observations(county_id,listing_type,property_type,observed_at);
CREATE TABLE atlas_core.entity_matches (
 listing_id uuid PRIMARY KEY REFERENCES atlas_core.source_listings, property_id uuid NOT NULL REFERENCES atlas_core.properties,
 reviewed_by text NOT NULL, reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500), reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE atlas_core.indicator_observations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_id uuid NOT NULL REFERENCES atlas_control.sources,
 job_id uuid NOT NULL REFERENCES atlas_control.jobs, artifact_id uuid NOT NULL REFERENCES atlas_control.artifacts,
 indicator_code text NOT NULL, indicator_name text NOT NULL, unit text NOT NULL,
 country_code text NOT NULL CHECK(country_code='KEN'), reference_year integer NOT NULL CHECK(reference_year BETWEEN 1960 AND 2100),
 value numeric NOT NULL, content_hash text NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,indicator_code,reference_year,content_hash)
);
CREATE TABLE atlas_mart.releases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), input_cutoff timestamptz NOT NULL,
 methodology text NOT NULL DEFAULT 'asking-market/1', listing_count integer NOT NULL, active_count integer NOT NULL,
 source_count integer NOT NULL, minimum_sample integer NOT NULL DEFAULT 30,
 status text NOT NULL DEFAULT 'published' CHECK(status='published')
);
CREATE TABLE atlas_mart.market_snapshots (
 release_id uuid NOT NULL REFERENCES atlas_mart.releases, county_id uuid NOT NULL REFERENCES atlas_core.locations,
 listing_type text NOT NULL, property_type text NOT NULL, bedrooms smallint NOT NULL DEFAULT -1,
 listing_count integer NOT NULL, source_count integer NOT NULL, median_price numeric, p25 numeric, p75 numeric, mean_price numeric,
 area_sample_count integer NOT NULL, median_price_per_sqm numeric, sparse boolean NOT NULL,
 PRIMARY KEY(release_id,county_id,listing_type,property_type,bedrooms)
);
CREATE TABLE atlas_mart.current_release (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), release_id uuid NOT NULL REFERENCES atlas_mart.releases
);
CREATE TABLE atlas_security.operator_roles (
 user_id text PRIMARY KEY, role text NOT NULL CHECK(role IN ('operator','admin')), granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE atlas_security.rate_windows (
 key_hash text NOT NULL, window_start timestamptz NOT NULL, hits integer NOT NULL, PRIMARY KEY(key_hash,window_start)
);
CREATE FUNCTION atlas_security.take_rate_limit(key_value text, limit_value integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,atlas_security AS $$
DECLARE n integer; BEGIN
 IF length(key_value)<>64 OR limit_value NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'invalid rate request'; END IF;
 INSERT INTO atlas_security.rate_windows(key_hash,window_start,hits) VALUES(key_value,date_trunc('minute',clock_timestamp()),1)
 ON CONFLICT(key_hash,window_start) DO UPDATE SET hits=atlas_security.rate_windows.hits+1 RETURNING hits INTO n;
 RETURN n<=limit_value;
END $$;
REVOKE ALL ON FUNCTION atlas_security.take_rate_limit(text,integer) FROM PUBLIC;
CREATE FUNCTION atlas_control.prevent_evidence_change() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'evidence is append-only'; END $$;
CREATE TRIGGER immutable_observations BEFORE UPDATE OR DELETE ON atlas_core.listing_observations FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE TRIGGER immutable_indicators BEFORE UPDATE OR DELETE ON atlas_core.indicator_observations FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE TRIGGER immutable_boundaries BEFORE UPDATE OR DELETE ON atlas_core.location_versions FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON atlas_control.audit_events FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
ALTER TABLE public.atlas_reports ADD COLUMN content_bytes integer NOT NULL DEFAULT 0 CHECK(content_bytes BETWEEN 0 AND 10000);
ALTER TABLE public.atlas_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_own ON public.atlas_reports FOR ALL TO atlas_api
 USING(owner_id=current_setting('atlas.user_id',true)) WITH CHECK(owner_id=current_setting('atlas.user_id',true));
REVOKE ALL ON ALL TABLES IN SCHEMA atlas_control,atlas_core,atlas_mart,atlas_security FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atlas_control FROM PUBLIC;
GRANT USAGE ON SCHEMA public,atlas_security TO atlas_api;
GRANT SELECT,INSERT,DELETE ON public.atlas_reports TO atlas_api;
GRANT EXECUTE ON FUNCTION atlas_security.take_rate_limit(text,integer) TO atlas_api;
GRANT USAGE ON SCHEMA atlas_control,atlas_core,atlas_mart TO atlas_api,atlas_worker;
GRANT SELECT ON ALL TABLES IN SCHEMA atlas_control,atlas_core,atlas_mart TO atlas_api,atlas_worker;
GRANT SELECT ON atlas_security.operator_roles TO atlas_api;
GRANT INSERT ON atlas_control.jobs,atlas_control.sources,atlas_control.audit_events TO atlas_api;
GRANT UPDATE(status,approved_at,approved_by,publication_allowed,rights_expire_at) ON atlas_control.sources TO atlas_api;
GRANT INSERT,UPDATE ON atlas_control.jobs,atlas_control.sources TO atlas_worker;
GRANT INSERT ON atlas_control.artifacts,atlas_control.job_artifacts,atlas_control.quality_issues,atlas_control.audit_events TO atlas_worker;
GRANT INSERT,UPDATE ON atlas_core.locations,atlas_core.location_aliases,atlas_core.source_listings TO atlas_worker;
GRANT INSERT ON atlas_core.location_versions,atlas_core.listing_observations,atlas_core.indicator_observations,atlas_core.properties TO atlas_worker;
GRANT INSERT,UPDATE ON ALL TABLES IN SCHEMA atlas_mart TO atlas_worker;
GRANT USAGE ON SCHEMA atlas_security TO atlas_worker;
GRANT DELETE ON atlas_security.rate_windows TO atlas_worker;
INSERT INTO atlas_control.sources(slug,name,driver,data_kind,status,license,permission_url,attribution,approved_at,approved_by,publication_allowed,refresh_seconds)
VALUES
 ('worldbank-wdi-ken','World Bank WDI Kenya contextual indicators','worldbank_wdi','context','active','CC BY 4.0','https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators','World Bank, World Development Indicators. Annual national context; not property prices or household income.',now(),'system:published-open-license',true,86400),
 ('geoboundaries-ken-counties','geoBoundaries Kenya counties - 2020 vintage','geoboundaries_ken','geography','active','CC BY 4.0; underlying boundary metadata: Public Domain','https://www.geoboundaries.org/api.html','geoBoundaries / William and Mary geoLab; RCMRD GeoPortal, Africa GeoPortal. Boundary vintage 2020; not a current cadastral survey.',now(),'system:published-open-license',true,604800);
