ALTER TABLE atlas_control.sources ADD COLUMN not_before_at timestamptz;
GRANT UPDATE(not_before_at) ON atlas_control.sources TO atlas_worker;
ALTER TABLE atlas_core.source_listings ADD CONSTRAINT source_listing_pair UNIQUE(source_id,id);
ALTER TABLE atlas_core.canonical_listing_urls ADD CONSTRAINT canonical_url_source_scope FOREIGN KEY(source_id,listing_id) REFERENCES atlas_core.source_listings(source_id,id);
