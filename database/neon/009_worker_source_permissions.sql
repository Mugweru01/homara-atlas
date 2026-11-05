-- Collection may advance a schedule/watermark but cannot approve its own rights.
REVOKE INSERT,UPDATE ON atlas_control.sources FROM atlas_worker;
GRANT UPDATE(next_run_at,last_success_at,watermark) ON atlas_control.sources TO atlas_worker;
