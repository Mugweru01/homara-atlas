-- Migration: 20250202_sync_kb_articles_bidirectional.sql
-- Description: Creates a trigger to sync updates from homaradesk_kb_articles to knowledge_base_articles
-- This ensures seamless synchronization when articles are edited in the admin panel

-- Function to sync homaradesk_kb_articles updates to knowledge_base_articles
CREATE OR REPLACE FUNCTION sync_homaradesk_to_kb_articles()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert into knowledge_base_articles
    -- Use slug as the id (which maps to knowledge_base_articles.id)
    INSERT INTO public.knowledge_base_articles (
        id,
        title,
        description,
        content_text,
        category_title,
        popular,
        last_updated,
        created_at
    ) VALUES (
        COALESCE(NEW.slug, NEW.id::text), -- Use slug as id, fallback to id as text
        NEW.title,
        NEW.summary,
        NEW.content,
        NEW.category,
        NEW.is_featured,
        COALESCE(NEW.updated_at, NOW()),
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        content_text = EXCLUDED.content_text,
        category_title = EXCLUDED.category_title,
        popular = EXCLUDED.popular,
        last_updated = EXCLUDED.last_updated;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on homaradesk_kb_articles for INSERT and UPDATE
DROP TRIGGER IF EXISTS sync_homaradesk_to_kb_articles_trigger ON public.homaradesk_kb_articles;

CREATE TRIGGER sync_homaradesk_to_kb_articles_trigger
    AFTER INSERT OR UPDATE ON public.homaradesk_kb_articles
    FOR EACH ROW
    EXECUTE FUNCTION sync_homaradesk_to_kb_articles();

-- Grant execute permission
GRANT EXECUTE ON FUNCTION sync_homaradesk_to_kb_articles TO authenticated, service_role;

-- Add comment
COMMENT ON FUNCTION sync_homaradesk_to_kb_articles() IS 'Syncs updates from homaradesk_kb_articles to knowledge_base_articles when articles are created or updated';

