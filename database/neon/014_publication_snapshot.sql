-- Withdraw any historical pointer regardless of incomplete release provenance.
-- Evidence remains intact; the worker publishes a new internally consistent release.
SELECT pg_advisory_xact_lock(hashtext('atlas-market-publication'));
DELETE FROM atlas_mart.current_release;
INSERT INTO atlas_control.publication_requests(singleton) VALUES(true)
 ON CONFLICT(singleton) DO UPDATE SET requested_at=now();
