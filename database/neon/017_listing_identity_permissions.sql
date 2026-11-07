REVOKE UPDATE ON atlas_core.source_listings FROM atlas_worker;
GRANT UPDATE(first_seen_at,last_seen_at) ON atlas_core.source_listings TO atlas_worker;
