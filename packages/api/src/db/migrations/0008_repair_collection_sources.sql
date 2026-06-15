-- Keep production source fixes reproducible from Git.
-- Idempotent for existing workspaces and future clean installs.

UPDATE sources
SET url = 'https://www.datadoghq.com/blog/index.xml',
    fetch_status = 'never',
    last_error = NULL,
    updated_at = NOW()
WHERE name = 'Datadog Blog'
  AND url = 'https://www.datadoghq.com/blog/feed/';

UPDATE sources
SET url = 'https://grafana.com/blog/index.xml',
    fetch_status = 'never',
    last_error = NULL,
    updated_at = NOW()
WHERE name = 'Grafana Blog'
  AND url = 'https://grafana.com/blog/feed.xml';

UPDATE sources
SET url = 'https://habr.com/ru/rss/hubs/design/articles/?fl=ru',
    fetch_status = 'never',
    last_error = NULL,
    updated_at = NOW()
WHERE name IN ('Хабр — Графический дизайн', 'РҐР°Р±СЂ вЂ” Р“СЂР°С„РёС‡РµСЃРєРёР№ РґРёР·Р°Р№РЅ')
  AND url = 'https://habr.com/ru/rss/hubs/graphic_design/articles/?fl=ru';

UPDATE sources
SET is_active = FALSE,
    fetch_status = 'error',
    last_error = 'Disabled: source RSS URL is unavailable',
    updated_at = NOW()
WHERE name IN ('Open Observability', 'IT-Костыли', 'MinIO Blog');

CREATE OR REPLACE FUNCTION _nr_insert_source_and_link(
  p_workspace_id UUID,
  p_agent_id UUID,
  p_name VARCHAR(200),
  p_type VARCHAR(10),
  p_url TEXT,
  p_channel VARCHAR(100),
  p_active BOOLEAN
) RETURNS VOID AS $$
DECLARE
  v_source_id UUID;
BEGIN
  SELECT id INTO v_source_id FROM sources WHERE url = p_url AND workspace_id = p_workspace_id LIMIT 1;
  IF v_source_id IS NULL THEN
    INSERT INTO sources (name, type, url, channel_username, is_active, workspace_id, fetch_count, error_count, fetch_status, health)
    VALUES (p_name, p_type, p_url, p_channel, p_active, p_workspace_id, 0, 0, 'never', '{}'::jsonb)
    RETURNING id INTO v_source_id;
  END IF;
  INSERT INTO agent_sources (agent_id, source_id)
  VALUES (p_agent_id, v_source_id)
  ON CONFLICT (agent_id, source_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  ws_id UUID;
  ag_id UUID;
BEGIN
  FOR ws_id IN SELECT id FROM workspaces LOOP
    FOR ag_id IN SELECT id FROM agents WHERE workspace_id = ws_id AND subject_area = 'construction' LOOP
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'RMNT — статьи по строительству и ремонту', 'rss', 'http://www.rmnt.ru/rss/news.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'АСН-инфо — строительные новости, рынок, технологии и материалы', 'rss', 'https://asninfo.ru/rss.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Construction Dive — зарубежное строительство и технологии', 'rss', 'https://www.constructiondive.com/feeds/news', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'ENR — общие строительные новости', 'rss', 'https://www.enr.com/rss/1', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'ENR / Materials — строительные материалы: бетон, асфальт, сталь, дерево', 'rss', 'https://www.enr.com/rss/topic/500-materials', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'ENR / Construction Technology — технологии строительства', 'rss', 'https://www.enr.com/rss/topic/587-construction-technology', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Construction Management — профессиональное строительство, продукты, технологии', 'rss', 'https://constructionmanagement.co.uk/feed', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Construction Management / Technology', 'rss', 'https://constructionmanagement.co.uk/category/features/technology/feed', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Architectural Record / Product Trends & Insights — материалы, продукты, отделка, архитектурные решения', 'rss', 'https://www.architecturalrecord.com/rss/topic/2927-product-trends-insights', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Architectural Record / Adaptive Reuse and Renovation — реконструкция и renovation', 'rss', 'https://www.architecturalrecord.com/rss/topic/2089-adaptive-reuse-and-renovation', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Architectural Record / Concrete & Masonry', 'rss', 'https://www.architecturalrecord.com/rss/topic/2009-concrete-masonry', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Architectural Record / Flooring', 'rss', 'https://www.architecturalrecord.com/rss/topic/2011-flooring', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Architectural Record / Roofing and Siding', 'rss', 'https://www.architecturalrecord.com/rss/topic/2022-roofing-siding', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'GreenBuildingAdvisor — энергоэффективные дома, строительство, remodeling', 'rss', 'https://www.greenbuildingadvisor.com/feed', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'The Construction Index / All News', 'rss', 'https://www.theconstructionindex.co.uk/feeds/news.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'The Construction Index / Product News', 'rss', 'https://www.theconstructionindex.co.uk/feeds/news-product.xml', NULL, true);
    END LOOP;
  END LOOP;
END;
$$;

DROP FUNCTION _nr_insert_source_and_link(UUID, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN);
