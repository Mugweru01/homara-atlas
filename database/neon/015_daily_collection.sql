ALTER TABLE atlas_control.sources DROP CONSTRAINT source_driver_contract;
ALTER TABLE atlas_control.sources DROP CONSTRAINT source_kind_contract;
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_driver_contract CHECK(driver IN ('manual_listings','homara_public','worldbank_wdi','geoboundaries_ken','kenya_locations','kpc_market','approved_listing_web'));
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_kind_contract CHECK((driver IN ('manual_listings','homara_public','approved_listing_web') AND data_kind='listings') OR (driver IN ('worldbank_wdi','kpc_market') AND data_kind='context') OR (driver IN ('geoboundaries_ken','kenya_locations') AND data_kind='geography'));
CREATE TABLE atlas_core.canonical_listing_urls (
 source_id uuid NOT NULL REFERENCES atlas_control.sources,url_sha256 text NOT NULL CHECK(url_sha256 ~ '^[0-9a-f]{64}$'),
 listing_id uuid NOT NULL REFERENCES atlas_core.source_listings,PRIMARY KEY(source_id,url_sha256)
);
REVOKE ALL ON atlas_core.canonical_listing_urls FROM PUBLIC,atlas_api;
GRANT SELECT,INSERT ON atlas_core.canonical_listing_urls TO atlas_worker;
-- Only unambiguous historical URLs are reserved. Ambiguous old URLs are
-- explicitly checked during ingestion and require review before reuse.
INSERT INTO atlas_core.canonical_listing_urls(source_id,url_sha256,listing_id)
 SELECT l.source_id,encode(sha256(convert_to(o.source_url,'UTF8')),'hex'),min(l.id::text)::uuid
 FROM atlas_core.listing_observations o JOIN atlas_core.source_listings l ON l.id=o.listing_id
 GROUP BY l.source_id,o.source_url HAVING count(DISTINCT l.id)=1 ON CONFLICT DO NOTHING;
CREATE INDEX observations_source_url ON atlas_core.listing_observations(source_url,listing_id);
CREATE TABLE atlas_control.crawl_configs (
 source_id uuid PRIMARY KEY REFERENCES atlas_control.sources,origin text NOT NULL CHECK(origin ~ '^https://'),
 path_prefix text NOT NULL CHECK(path_prefix LIKE '/%' AND length(path_prefix)<=200),
 seed_paths text[] NOT NULL CHECK(cardinality(seed_paths) BETWEEN 1 AND 5),
 listing_type text NOT NULL CHECK(listing_type IN ('rent','sale')),max_pages int NOT NULL DEFAULT 10 CHECK(max_pages BETWEEN 1 AND 10),
 reviewed_at timestamptz NOT NULL DEFAULT now(),reviewed_by text NOT NULL
);
REVOKE ALL ON atlas_control.crawl_configs FROM PUBLIC,atlas_api;
GRANT SELECT ON atlas_control.crawl_configs TO atlas_worker;
CREATE TABLE atlas_core.market_benchmarks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES atlas_control.sources,job_id uuid NOT NULL REFERENCES atlas_control.jobs,
 artifact_id uuid NOT NULL REFERENCES atlas_control.artifacts,series_key text NOT NULL,
 geography text NOT NULL CHECK(length(geography) BETWEEN 1 AND 160),market_type text NOT NULL CHECK(market_type IN ('rent','sale','short_let')),
 period_start date NOT NULL,period_end date NOT NULL,median_price numeric NOT NULL CHECK(median_price>0),
 sample_count int CHECK(sample_count>=0),currency text NOT NULL CHECK(currency='KES'),
 methodology text NOT NULL CHECK(length(methodology)<=2000),source_url text NOT NULL CHECK(source_url LIKE 'https://kenyapropertycentre.com/market-trends/average-prices%'),
 content_hash text NOT NULL CHECK(content_hash ~ '^[0-9a-f]{64}$'),retrieved_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,series_key,period_start,period_end,content_hash),CHECK(period_end>=period_start)
);
CREATE TRIGGER immutable_benchmarks BEFORE UPDATE OR DELETE ON atlas_core.market_benchmarks FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
GRANT SELECT ON atlas_core.market_benchmarks TO atlas_api,atlas_worker;
GRANT INSERT ON atlas_core.market_benchmarks TO atlas_worker;
CREATE TABLE atlas_control.source_reviews (
 slug text PRIMARY KEY,name text NOT NULL,website text NOT NULL,terms_url text NOT NULL,
 decision text NOT NULL CHECK(decision IN ('requires_permission','allowed_market_statistics','pending_review')),
 reason text NOT NULL,reviewed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON atlas_control.source_reviews TO atlas_api;
INSERT INTO atlas_control.source_reviews(slug,name,website,terms_url,decision,reason) VALUES
 ('jiji','Jiji Kenya','https://jiji.co.ke','https://jiji.co.ke/rules.html','requires_permission','Terms 7.16 require consent to copy or distribute user content; 7.17 prohibit collecting user information without consent. robots.txt is not a republication licence.'),
 ('buyrentkenya','BuyRentKenya','https://www.buyrentkenya.com','https://www.buyrentkenya.com/legal','requires_permission','Terms require prior written consent for mining/scraping content for another website.'),
 ('property24','Property24 Kenya','https://www.property24.co.ke','https://www.property24.co.ke/terms-and-conditions','requires_permission','Terms prohibit robots/spiders monitoring or copying and require written permission for republication.'),
 ('hauzisha','Hauzisha','https://hauzisha.co.ke','https://hauzisha.co.ke/terms-of-use/','requires_permission','Terms prohibit bulk crawling/listing collection and republication on another property site.'),
 ('kenya-property-centre','Kenya Property Centre','https://kenyapropertycentre.com','https://kenyapropertycentre.com/terms-of-use','allowed_market_statistics','CC BY 4.0 applies to published market statistics with credit and permits reasonable automated access respecting robots.txt; individual listings/photos/descriptions are excluded.');
