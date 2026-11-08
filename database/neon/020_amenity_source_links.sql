ALTER TABLE atlas_research.amenities DROP CONSTRAINT amenities_source_url_check;
ALTER TABLE atlas_research.amenities ADD CONSTRAINT amenities_source_url_check CHECK(
 source_url ~ '^https://www.openstreetmap.org/(node|way|relation)/[0-9]+$' OR source_url ~ '^https://www.geonames.org/[0-9]+/$'
);
