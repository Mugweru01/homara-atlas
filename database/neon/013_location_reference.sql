ALTER TABLE atlas_control.sources DROP CONSTRAINT sources_driver_check;
ALTER TABLE atlas_control.sources DROP CONSTRAINT sources_check1;
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_driver_contract CHECK(driver IN ('manual_listings','homara_public','worldbank_wdi','geoboundaries_ken','kenya_locations'));
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_kind_contract CHECK((driver IN ('manual_listings','homara_public') AND data_kind='listings') OR (driver='worldbank_wdi' AND data_kind='context') OR (driver IN ('geoboundaries_ken','kenya_locations') AND data_kind='geography'));
CREATE SCHEMA atlas_geo;
REVOKE ALL ON SCHEMA atlas_geo FROM PUBLIC;
CREATE TABLE atlas_geo.releases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),source_id uuid NOT NULL REFERENCES atlas_control.sources,
 revision text UNIQUE NOT NULL CHECK(revision ~ '^[0-9a-f]{40}$'),package_version text NOT NULL,
 manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[0-9a-f]{64}$'),
 provenance jsonb NOT NULL,imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE atlas_geo.places (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN ('county','constituency','ward','sub_county','locality','area')),
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 500),UNIQUE(kind,source_key)
);
CREATE TABLE atlas_geo.versions (
 release_id uuid NOT NULL REFERENCES atlas_geo.releases,place_id uuid NOT NULL REFERENCES atlas_geo.places,
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),county_code text NOT NULL CHECK(county_code ~ '^[0-9]{3}$'),
 code text,metadata jsonb NOT NULL DEFAULT '{}',provenance_class text NOT NULL CHECK(provenance_class IN ('electoral_reference','third_party_historical','informal_unverified')),
 PRIMARY KEY(release_id,place_id)
);
CREATE INDEX geo_versions_county ON atlas_geo.versions(release_id,county_code,name,place_id);
CREATE TABLE atlas_geo.relations (
 release_id uuid NOT NULL,child_id uuid NOT NULL,parent_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('county','constituency','sub_county','locality')),
 method text NOT NULL CHECK(method IN ('exact','guided','fuzzy','inferred','unverified')),
 PRIMARY KEY(release_id,child_id,kind),CHECK(child_id<>parent_id),
 FOREIGN KEY(release_id,child_id) REFERENCES atlas_geo.versions(release_id,place_id),
 FOREIGN KEY(release_id,parent_id) REFERENCES atlas_geo.versions(release_id,place_id)
);
CREATE INDEX geo_relations_parent ON atlas_geo.relations(release_id,parent_id,child_id);
CREATE TABLE atlas_geo.county_mapping (
 release_id uuid NOT NULL REFERENCES atlas_geo.releases,county_code text NOT NULL,
 location_id uuid NOT NULL REFERENCES atlas_core.locations,PRIMARY KEY(release_id,county_code),UNIQUE(release_id,location_id)
);
CREATE TABLE atlas_geo.current_release (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),release_id uuid NOT NULL REFERENCES atlas_geo.releases
);
CREATE VIEW atlas_geo.published_release WITH(security_barrier=true) AS
 SELECT r.* FROM atlas_geo.releases r JOIN atlas_geo.current_release c ON c.release_id=r.id
 JOIN atlas_control.sources s ON s.id=r.source_id WHERE s.status='active' AND s.publication_allowed
 AND(s.rights_expire_at IS NULL OR s.rights_expire_at>now());
CREATE VIEW atlas_geo.published_places WITH(security_barrier=true) AS
 SELECT p.id,p.kind,p.source_key,v.name,v.county_code,v.code,v.metadata,v.provenance_class,v.release_id
 FROM atlas_geo.versions v JOIN atlas_geo.places p ON p.id=v.place_id JOIN atlas_geo.published_release r ON r.id=v.release_id;
CREATE VIEW atlas_geo.published_relations WITH(security_barrier=true) AS
 SELECT x.* FROM atlas_geo.relations x JOIN atlas_geo.published_release r ON r.id=x.release_id;
CREATE VIEW atlas_geo.published_county_mapping WITH(security_barrier=true) AS
 SELECT m.* FROM atlas_geo.county_mapping m JOIN atlas_geo.published_release r ON r.id=m.release_id;
REVOKE ALL ON ALL TABLES IN SCHEMA atlas_geo FROM PUBLIC,atlas_api,atlas_worker;
GRANT USAGE ON SCHEMA atlas_geo TO atlas_api;
GRANT SELECT ON atlas_geo.published_release,atlas_geo.published_places,atlas_geo.published_relations,atlas_geo.published_county_mapping TO atlas_api;
CREATE TRIGGER immutable_geo_release BEFORE UPDATE OR DELETE ON atlas_geo.releases FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE TRIGGER immutable_geo_version BEFORE UPDATE OR DELETE ON atlas_geo.versions FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE TRIGGER immutable_geo_relation BEFORE UPDATE OR DELETE ON atlas_geo.relations FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
CREATE TRIGGER immutable_geo_mapping BEFORE UPDATE OR DELETE ON atlas_geo.county_mapping FOR EACH ROW EXECUTE FUNCTION atlas_control.prevent_evidence_change();
