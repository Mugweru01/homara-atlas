ALTER TABLE atlas_control.sources ADD COLUMN collection_transport text NOT NULL DEFAULT 'worker'
 CHECK(collection_transport IN ('worker','source_push'));
ALTER TABLE atlas_control.sources ADD CONSTRAINT source_push_scope CHECK(collection_transport<>'source_push' OR driver='kpc_market');
