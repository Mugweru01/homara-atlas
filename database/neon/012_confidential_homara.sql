-- Confidential by construction. Even an operator cannot publish this feed.
UPDATE atlas_control.sources SET publication_allowed=false,listing_details_allowed=false WHERE driver='homara_public';
ALTER TABLE atlas_control.sources ADD CONSTRAINT homara_never_public
 CHECK(driver<>'homara_public' OR (NOT publication_allowed AND NOT listing_details_allowed));
ALTER TABLE atlas_core.source_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listing_api_nonconfidential ON atlas_core.source_listings FOR ALL TO atlas_api
 USING(EXISTS(SELECT 1 FROM atlas_control.sources s WHERE s.id=source_id AND s.driver<>'homara_public'));
CREATE POLICY listing_worker ON atlas_core.source_listings FOR ALL TO atlas_worker USING(true) WITH CHECK(true);
ALTER TABLE atlas_core.listing_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY observation_api_nonconfidential ON atlas_core.listing_observations FOR SELECT TO atlas_api
 USING(EXISTS(SELECT 1 FROM atlas_core.source_listings l WHERE l.id=listing_id));
CREATE POLICY observation_worker ON atlas_core.listing_observations FOR ALL TO atlas_worker USING(true) WITH CHECK(true);
ALTER TABLE atlas_control.artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY artifact_api_nonconfidential ON atlas_control.artifacts FOR SELECT TO atlas_api
 USING(EXISTS(SELECT 1 FROM atlas_control.sources s WHERE s.id=source_id AND s.driver<>'homara_public'));
CREATE POLICY artifact_worker ON atlas_control.artifacts FOR ALL TO atlas_worker USING(true) WITH CHECK(true);
