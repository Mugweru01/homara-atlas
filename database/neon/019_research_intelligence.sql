CREATE SCHEMA atlas_research;
REVOKE ALL ON SCHEMA atlas_research FROM PUBLIC;
GRANT USAGE ON SCHEMA atlas_research TO atlas_api,atlas_worker;
ALTER TABLE atlas_control.sources DROP CONSTRAINT source_driver_contract;
ALTER TABLE atlas_control.sources DROP CONSTRAINT source_kind_contract;
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_driver_contract CHECK(driver IN ('manual_listings','homara_public','worldbank_wdi','geoboundaries_ken','kenya_locations','kpc_market','approved_listing_web','reviewed_research'));
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_kind_contract CHECK((driver IN ('manual_listings','homara_public','approved_listing_web') AND data_kind='listings') OR (driver IN ('worldbank_wdi','kpc_market','reviewed_research') AND data_kind='context') OR (driver IN ('geoboundaries_ken','kenya_locations') AND data_kind='geography'));

CREATE TABLE atlas_research.amenities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES atlas_control.sources,
 source_key text NOT NULL CHECK(length(source_key)<=100),county_id uuid NOT NULL REFERENCES atlas_core.locations,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),category text NOT NULL CHECK(category IN ('school','college','university','hospital','clinic','bus_station','marketplace','supermarket')),
 latitude double precision NOT NULL CHECK(latitude BETWEEN -4.8 AND 5.6),longitude double precision NOT NULL CHECK(longitude BETWEEN 33.8 AND 42),
 source_url text NOT NULL CHECK(source_url ~ '^https://www.openstreetmap.org/(node|way|relation)/[0-9]+$'),
 retrieved_at timestamptz NOT NULL,coverage text NOT NULL CHECK(length(coverage)<=500),UNIQUE(source_id,source_key)
);
CREATE INDEX amenities_county ON atlas_research.amenities(county_id,category);
CREATE TABLE atlas_research.project_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES atlas_control.sources,
 project_key text NOT NULL CHECK(length(project_key)<=100),county_id uuid NOT NULL REFERENCES atlas_core.locations,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),category text NOT NULL CHECK(category IN ('transport','roads','water','energy','housing','other')),
 status text NOT NULL CHECK(status IN ('proposed','funded','underway','completed','on_hold','cancelled')),
 evidence_date date NOT NULL CHECK(evidence_date<='2100-01-01'),summary text NOT NULL CHECK(length(summary) BETWEEN 10 AND 500),
 source_url text NOT NULL CHECK(source_url ~ '^https://'),reviewed_at timestamptz NOT NULL DEFAULT now(),reviewed_by text NOT NULL,
 UNIQUE(source_id,project_key,evidence_date,status,source_url)
);
CREATE TRIGGER immutable_project_events BEFORE UPDATE OR DELETE ON atlas_research.project_events FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE VIEW atlas_research.public_amenities WITH(security_barrier=true) AS
 SELECT a.*,s.attribution,s.license FROM atlas_research.amenities a JOIN atlas_control.sources s ON s.id=a.source_id
 WHERE s.driver='reviewed_research' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now());
CREATE VIEW atlas_research.public_projects WITH(security_barrier=true) AS
 SELECT p.*,s.attribution,s.license FROM atlas_research.project_events p JOIN atlas_control.sources s ON s.id=p.source_id
 WHERE s.driver='reviewed_research' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now());
GRANT SELECT ON atlas_research.public_amenities,atlas_research.public_projects TO atlas_api;

CREATE TABLE public.atlas_research_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id text NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 payload jsonb NOT NULL CHECK(octet_length(payload::text)<=20000),evidence jsonb NOT NULL CHECK(octet_length(evidence::text)<=200000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_items_owner ON public.atlas_research_items(owner_id,created_at DESC);
ALTER TABLE public.atlas_research_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_items_own ON public.atlas_research_items FOR ALL TO atlas_api USING(owner_id=current_setting('atlas.user_id',true)) WITH CHECK(owner_id=current_setting('atlas.user_id',true));
REVOKE ALL ON public.atlas_research_items FROM PUBLIC;
GRANT SELECT,INSERT,DELETE ON public.atlas_research_items TO atlas_api;

CREATE TABLE public.atlas_watchlists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id text NOT NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 geography text NOT NULL CHECK(length(geography) BETWEEN 1 AND 160),market_type text NOT NULL CHECK(market_type IN ('rent','sale','short_let')),
 threshold_percent numeric NOT NULL CHECK(threshold_percent BETWEEN 0.1 AND 100),direction text NOT NULL CHECK(direction IN ('up','down','either')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX watchlists_owner ON public.atlas_watchlists(owner_id,created_at DESC);
ALTER TABLE public.atlas_watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY watchlists_own ON public.atlas_watchlists FOR ALL TO atlas_api USING(owner_id=current_setting('atlas.user_id',true)) WITH CHECK(owner_id=current_setting('atlas.user_id',true));
REVOKE ALL ON public.atlas_watchlists FROM PUBLIC;
GRANT SELECT,INSERT,DELETE ON public.atlas_watchlists TO atlas_api;
CREATE TABLE public.atlas_research_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),watch_id uuid NOT NULL REFERENCES public.atlas_watchlists ON DELETE CASCADE,
 owner_id text NOT NULL,benchmark_id uuid NOT NULL REFERENCES atlas_core.market_benchmarks,source_id uuid NOT NULL REFERENCES atlas_control.sources,
 geography text NOT NULL,market_type text NOT NULL,period_end date NOT NULL,previous_period date NOT NULL,change_percent numeric NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(watch_id,benchmark_id)
);
ALTER TABLE public.atlas_research_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY research_alerts_own ON public.atlas_research_alerts FOR SELECT TO atlas_api USING(owner_id=current_setting('atlas.user_id',true)
 AND EXISTS(SELECT 1 FROM atlas_control.sources s WHERE s.id=source_id AND s.driver='kpc_market' AND s.status='active' AND s.publication_allowed AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now())));
REVOKE ALL ON public.atlas_research_alerts FROM PUBLIC;
GRANT SELECT ON public.atlas_research_alerts TO atlas_api;

-- Worker gets a narrow evaluator, never access to private watchlists/research.
CREATE FUNCTION atlas_research.evaluate_watchlists() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,pg_temp AS $$
DECLARE inserted integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('atlas-watchlist-evaluation'));
 WITH revisions AS (
  SELECT DISTINCT ON(b.source_id,b.series_key,b.period_end) b.* FROM atlas_core.market_benchmarks b
  JOIN atlas_control.sources s ON s.id=b.source_id WHERE s.driver='kpc_market' AND s.status='active' AND s.publication_allowed
  AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now()) ORDER BY b.source_id,b.series_key,b.period_end,b.retrieved_at DESC,b.id DESC
 ), changes AS (
  SELECT r.*,lag(median_price) OVER(PARTITION BY source_id,series_key ORDER BY period_end) previous_price,
   lag(period_end) OVER(PARTITION BY source_id,series_key ORDER BY period_end) previous_period,
   row_number() OVER(PARTITION BY source_id,series_key ORDER BY period_end DESC) latest FROM revisions r
 ) INSERT INTO public.atlas_research_alerts(watch_id,owner_id,benchmark_id,source_id,geography,market_type,period_end,previous_period,change_percent)
 SELECT w.id,w.owner_id,c.id,c.source_id,c.geography,c.market_type,c.period_end,c.previous_period,round((c.median_price/c.previous_price-1)*100,4)
 FROM changes c JOIN public.atlas_watchlists w ON lower(w.geography)=lower(c.geography) AND w.market_type=c.market_type
 WHERE c.latest=1 AND c.previous_price>0 AND c.retrieved_at>=w.created_at AND abs((c.median_price/c.previous_price-1)*100)>=w.threshold_percent
 AND(w.direction='either' OR(w.direction='up' AND c.median_price>c.previous_price) OR(w.direction='down' AND c.median_price<c.previous_price))
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted=ROW_COUNT;
 DELETE FROM public.atlas_research_alerts WHERE created_at<now()-interval '90 days' OR id IN
  (SELECT id FROM(SELECT id,row_number() OVER(PARTITION BY owner_id ORDER BY created_at DESC,id) n FROM public.atlas_research_alerts) ranked WHERE n>200);
 RETURN inserted;
END $$;
REVOKE ALL ON FUNCTION atlas_research.evaluate_watchlists() FROM PUBLIC,atlas_api;
GRANT EXECUTE ON FUNCTION atlas_research.evaluate_watchlists() TO atlas_worker;
