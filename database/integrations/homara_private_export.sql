-- Apply through Homara's Supabase MCP. Provision only a SHA-256 token hash in
-- the private settings table afterwards. Atlas receives no service-role key.
DO $$ BEGIN
 IF to_regprocedure('public.atlas_public_listing_export(uuid)') IS NOT NULL THEN
  REVOKE ALL ON FUNCTION public.atlas_public_listing_export(uuid) FROM PUBLIC,anon,authenticated;
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS atlas_export_private;
REVOKE ALL ON SCHEMA atlas_export_private FROM PUBLIC,anon,authenticated;
CREATE TABLE atlas_export_private.settings (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 token_hash bytea NOT NULL CHECK(octet_length(token_hash)=32)
);
REVOKE ALL ON atlas_export_private.settings FROM PUBLIC,anon,authenticated;
ALTER TABLE atlas_export_private.settings ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.atlas_private_listing_export(p_token text,p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET statement_timeout='5s' AS $$
DECLARE result jsonb;
BEGIN
 IF p_token IS NULL OR length(p_token)<>64 OR NOT EXISTS(
  SELECT 1 FROM atlas_export_private.settings WHERE token_hash=pg_catalog.sha256(pg_catalog.convert_to(p_token,'UTF8'))
 ) THEN RAISE EXCEPTION 'export_access_denied' USING ERRCODE='42501'; END IF;
 PERFORM pg_catalog.set_config('response.headers','[{"Cache-Control":"private, no-store"}]',true);
 WITH eligible AS (
  SELECT p.id,p.county,p.listing_type,p.property_type,p.bedrooms,p.bathrooms,
   CASE WHEN p.listing_type='rent' THEN coalesce(p.monthly_rent,p.price_kes)
        WHEN p.listing_type='sale' THEN coalesce(p.sale_price,p.price_kes) END price_amount,p.updated_at
  FROM public.properties p WHERE p.is_active AND p.approval_status='approved'
   AND (p.expires_at IS NULL OR p.expires_at>now())
   AND (p.source IS NULL OR p.source='field_operations') AND p.listing_type IN ('rent','sale')
   AND (p_after IS NULL OR p.id>p_after) ORDER BY p.id LIMIT 501
 ),page AS(SELECT * FROM eligible ORDER BY id LIMIT 500)
 SELECT jsonb_build_object('schema_version',1,'records',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY id) FROM page),'[]'::jsonb),
 'has_more',(SELECT count(*)>500 FROM eligible)) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.atlas_private_listing_export(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.atlas_private_listing_export(text,uuid) TO anon;
COMMENT ON FUNCTION public.atlas_private_listing_export(text,uuid) IS 'Secret-gated server-to-server Atlas ingestion only. Fixed approved advertisement projection; no identity/contact/private customer fields. Missing configuration denies every request.';
