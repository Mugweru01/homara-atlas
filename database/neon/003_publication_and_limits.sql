ALTER TABLE atlas_control.jobs ADD COLUMN request_hash text NOT NULL DEFAULT 'legacy';
CREATE TABLE atlas_mart.release_sources (
 release_id uuid NOT NULL REFERENCES atlas_mart.releases, source_id uuid NOT NULL REFERENCES atlas_control.sources,
 PRIMARY KEY(release_id,source_id)
);
GRANT SELECT ON atlas_mart.release_sources TO atlas_api,atlas_worker;
GRANT INSERT ON atlas_mart.release_sources TO atlas_worker;
-- Public reads fail closed if any contributing source loses its publication rights.
CREATE VIEW atlas_mart.valid_release AS
 SELECT r.* FROM atlas_mart.current_release c JOIN atlas_mart.releases r ON r.id=c.release_id
 WHERE NOT EXISTS(SELECT 1 FROM atlas_mart.release_sources rs JOIN atlas_control.sources s ON s.id=rs.source_id
 WHERE rs.release_id=r.id AND (s.status<>'active' OR NOT s.publication_allowed OR (s.rights_expire_at IS NOT NULL AND s.rights_expire_at<=now())));
GRANT SELECT ON atlas_mart.valid_release TO atlas_api,atlas_worker;
GRANT INSERT,UPDATE ON atlas_core.properties,atlas_core.entity_matches TO atlas_api;
GRANT UPDATE(property_id) ON atlas_core.source_listings TO atlas_api;
CREATE INDEX indicator_latest ON atlas_core.indicator_observations(source_id,indicator_code,reference_year,retrieved_at DESC);
CREATE INDEX quality_job ON atlas_control.quality_issues(job_id);
CREATE INDEX artifacts_source ON atlas_control.artifacts(source_id,retrieved_at DESC);
