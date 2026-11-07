ALTER TABLE atlas_control.sources DROP CONSTRAINT sources_driver_check;
ALTER TABLE atlas_control.sources DROP CONSTRAINT sources_check1;
ALTER TABLE atlas_control.sources ADD CHECK(driver IN ('manual_listings','homara_public','worldbank_wdi','geoboundaries_ken'));
ALTER TABLE atlas_control.sources ADD CHECK((driver IN ('manual_listings','homara_public') AND data_kind='listings') OR (driver='worldbank_wdi' AND data_kind='context') OR (driver='geoboundaries_ken' AND data_kind='geography'));
ALTER TABLE atlas_core.listing_observations ADD COLUMN bathrooms smallint CHECK(bathrooms BETWEEN 0 AND 30);
-- There is deliberately no activation in a migration. Owner approval is recorded
-- separately after validating the projection and exercising the live connector.
