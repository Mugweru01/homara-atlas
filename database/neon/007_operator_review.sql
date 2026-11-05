ALTER TABLE atlas_control.quality_issues ADD COLUMN review_state text NOT NULL DEFAULT 'open' CHECK(review_state IN ('open','acknowledged'));
ALTER TABLE atlas_control.quality_issues ADD COLUMN reviewed_by text;
ALTER TABLE atlas_control.quality_issues ADD COLUMN reviewed_at timestamptz;
ALTER TABLE atlas_control.quality_issues ADD COLUMN review_note text CHECK(length(review_note) BETWEEN 10 AND 500);
GRANT UPDATE(review_state,reviewed_by,reviewed_at,review_note) ON atlas_control.quality_issues TO atlas_api;
GRANT DELETE ON atlas_core.entity_matches TO atlas_api;
CREATE TABLE atlas_control.publication_requests (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), requested_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON atlas_control.publication_requests TO atlas_api,atlas_worker;
