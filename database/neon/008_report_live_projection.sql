-- Realtime currently rejects any query involving RLS. Keep report records RLS
-- protected; expose only a transactional metadata projection via owner-sealed SQL.
CREATE TABLE public.atlas_report_live (
 id uuid PRIMARY KEY,owner_id text NOT NULL,title text NOT NULL,created_at timestamptz NOT NULL
);
CREATE INDEX atlas_report_live_owner ON public.atlas_report_live(owner_id,created_at DESC);
REVOKE ALL ON public.atlas_report_live FROM PUBLIC,atlas_api,atlas_worker;
CREATE FUNCTION atlas_control.sync_report_live() RETURNS trigger LANGUAGE plpgsql
 SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='DELETE' THEN DELETE FROM public.atlas_report_live WHERE id=OLD.id;RETURN OLD; END IF;
 IF NEW.storage_state='ready' THEN
  INSERT INTO public.atlas_report_live(id,owner_id,title,created_at) VALUES(NEW.id,NEW.owner_id,NEW.title,NEW.created_at)
  ON CONFLICT(id) DO UPDATE SET owner_id=EXCLUDED.owner_id,title=EXCLUDED.title,created_at=EXCLUDED.created_at;
 ELSE DELETE FROM public.atlas_report_live WHERE id=NEW.id;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION atlas_control.sync_report_live() FROM PUBLIC;
CREATE TRIGGER report_live_projection AFTER INSERT OR UPDATE OR DELETE ON public.atlas_reports
 FOR EACH ROW EXECUTE FUNCTION atlas_control.sync_report_live();
INSERT INTO public.atlas_report_live SELECT id,owner_id,title,created_at FROM public.atlas_reports WHERE storage_state='ready';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='neon_superuser') THEN
  GRANT SELECT ON public.atlas_report_live TO neon_superuser;
 END IF;
END $$;
