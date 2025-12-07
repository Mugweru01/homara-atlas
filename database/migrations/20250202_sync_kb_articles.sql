-- Migration: Sync knowledge_base_articles to homaradesk_kb_articles
-- Description: Migrates existing knowledge base articles to HomaraDesk KB system
-- Created: February 2, 2025

-- Function to sync all articles from knowledge_base_articles to homaradesk_kb_articles
CREATE OR REPLACE FUNCTION sync_kb_articles_to_homaradesk()
RETURNS JSONB AS $$
DECLARE
  r RECORD;
  articles_processed INTEGER := 0;
  articles_created INTEGER := 0;
  articles_updated INTEGER := 0;
  v_content TEXT;
  v_slug VARCHAR(255);
BEGIN
  FOR r IN
    SELECT 
      id,
      title,
      description,
      category_title,
      content_text,
      content_json,
      popular,
      created_at,
      last_updated
    FROM public.knowledge_base_articles
    ORDER BY created_at
  LOOP
    articles_processed := articles_processed + 1;

    -- Use content_text if available, otherwise try to extract from content_json
    v_content := r.content_text;
    IF v_content IS NULL AND r.content_json IS NOT NULL THEN
      -- Try to extract text from JSON if it's a structured format
      v_content := r.content_json::text;
    END IF;
    
    -- If still no content, use description as fallback
    IF v_content IS NULL OR v_content = '' THEN
      v_content := r.description || E'\n\n' || 'Content coming soon...';
    END IF;

    -- Use the original id as slug (it's already a slug format)
    v_slug := r.id;

    -- Insert or update article
    INSERT INTO public.homaradesk_kb_articles (
      id,
      title,
      summary,
      content,
      category,
      slug,
      is_published,
      is_featured,
      view_count,
      helpful_count,
      not_helpful_count,
      author_id,
      created_at,
      updated_at,
      published_at
    ) VALUES (
      gen_random_uuid(), -- Generate new UUID
      r.title,
      r.description,
      v_content,
      r.category_title,
      v_slug,
      TRUE, -- Publish all migrated articles
      COALESCE(r.popular, FALSE), -- Map popular to is_featured
      0, -- Reset view count
      0, -- Reset helpful count
      0, -- Reset not helpful count
      NULL, -- No author (system migration)
      COALESCE(r.created_at, NOW()),
      COALESCE(r.last_updated, NOW()),
      COALESCE(r.created_at, NOW()) -- Set published_at to created_at
    )
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      content = EXCLUDED.content,
      category = EXCLUDED.category,
      is_published = TRUE, -- Ensure published
      is_featured = EXCLUDED.is_featured,
      updated_at = NOW();

    IF FOUND THEN
      articles_updated := articles_updated + 1;
    ELSE
      articles_created := articles_created + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'articles_processed', articles_processed,
    'articles_created', articles_created,
    'articles_updated', articles_updated,
    'message', 'Knowledge base articles synced successfully'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_kb_articles_to_homaradesk() TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION sync_kb_articles_to_homaradesk() IS 'Syncs all articles from knowledge_base_articles to homaradesk_kb_articles table';

