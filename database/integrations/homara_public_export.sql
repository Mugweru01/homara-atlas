-- Historical projection, intentionally not callable by any client role.
-- The active worker feed is homara_private_export.sql.
CREATE OR REPLACE FUNCTION public.atlas_public_listing_export(p_after uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 WITH eligible AS (
  SELECT p.id,p.county,p.listing_type,p.property_type,p.bedrooms,p.bathrooms,
   CASE WHEN p.listing_type='rent' THEN coalesce(p.monthly_rent,p.price_kes)
        WHEN p.listing_type='sale' THEN coalesce(p.sale_price,p.price_kes) END price_amount,
   p.updated_at
  FROM public.properties p WHERE p.is_active AND p.approval_status='approved'
   AND (p.expires_at IS NULL OR p.expires_at>now())
   AND (p.source IS NULL OR p.source='field_operations')
   AND p.listing_type IN ('rent','sale') AND (p_after IS NULL OR p.id>p_after)
  ORDER BY p.id LIMIT 501
 ), page AS (SELECT * FROM eligible ORDER BY id LIMIT 500)
 SELECT jsonb_build_object('schema_version',1,'records',coalesce((SELECT jsonb_agg(to_jsonb(page) ORDER BY id) FROM page),'[]'::jsonb),
  'has_more',(SELECT count(*)>500 FROM eligible));
$$;
REVOKE ALL ON FUNCTION public.atlas_public_listing_export(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atlas_public_listing_export(uuid) FROM anon,authenticated;
COMMENT ON FUNCTION public.atlas_public_listing_export(uuid) IS 'Atlas public advertisements only; excludes identities, contacts, coordinates, descriptions, messages and applications. Monthly rentals and sales only; no third-party scraped feeds.';
