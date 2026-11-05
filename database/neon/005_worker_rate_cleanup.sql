-- DELETE with a predicate also needs SELECT on the predicate column.
-- The worker still cannot read client key hashes or their counters.
GRANT SELECT(window_start) ON atlas_security.rate_windows TO atlas_worker;
