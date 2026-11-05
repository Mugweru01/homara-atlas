-- A source cannot assert two different states for the same advertised observation time.
ALTER TABLE atlas_core.listing_observations ADD CONSTRAINT one_state_per_observation UNIQUE(listing_id,observed_at);
