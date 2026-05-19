-- Seed default sources from TZ Appendix to EXISTING agents by subject_area
-- Idempotent: checks for existing sources by URL per workspace before inserting
-- No new agents are created — sources are added to agents that already exist

-- Step 1: Create helper function
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

-- Step 2: Insert sources for each workspace's agents
DO $$
DECLARE
  ws_id UUID;
  ag_id UUID;
  ag_subject_area VARCHAR(50);
BEGIN
  FOR ws_id IN SELECT id FROM workspaces LOOP
    FOR ag_id, ag_subject_area IN SELECT id, subject_area FROM agents WHERE workspace_id = ws_id LOOP
      IF ag_subject_area IS NULL THEN CONTINUE; END IF;

      -- ─── CYBERSEC ───
      IF ag_subject_area = 'cybersec' THEN
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Хабр — Информационная безопасность', 'rss', 'https://habr.com/ru/rss/hubs/infosecurity/articles/?fl=ru', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'SecurityLab', 'rss', 'https://www.securitylab.ru/_Services/Export/RSS/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Kaspersky Daily RU', 'rss', 'https://www.kaspersky.ru/blog/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'The Hacker News', 'rss', 'https://feeds.feedburner.com/TheHackersNews', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'BleepingComputer', 'rss', 'https://www.bleepingcomputer.com/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'CISA Cybersecurity Advisories', 'rss', 'https://www.cisa.gov/cybersecurity-advisories/all.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'CVE Daily — Critical', 'rss', 'https://cvedaily.com/feed-critical.xml', NULL, false);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Positive Technologies', 'telegram', 'https://t.me/Positive_Technologies', 'Positive_Technologies', true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Kaspersky Daily', 'telegram', 'https://t.me/KasperskyDaily', 'KasperskyDaily', true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'The Hacker News (Telegram)', 'telegram', 'https://t.me/thehackernews', 'thehackernews', false);

      -- ─── AI ───
      ELSIF ag_subject_area = 'ai' THEN
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Хабр — Искусственный интеллект', 'rss', 'https://habr.com/ru/rss/hubs/artificial_intelligence/articles/?fl=ru', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Hugging Face Blog', 'rss', 'https://huggingface.co/blog/feed.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'arXiv cs.AI', 'rss', 'https://export.arxiv.org/rss/cs.AI', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'arXiv cs.CL', 'rss', 'https://export.arxiv.org/rss/cs.CL', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'MIT Technology Review — AI', 'rss', 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'VentureBeat AI', 'rss', 'https://venturebeat.com/category/ai/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Hacker News — AI search feed', 'rss', 'https://hnrss.org/newest?q=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Claude%20OR%20Gemini', NULL, false);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Хабр (Telegram)', 'telegram', 'https://t.me/habr_com', 'habr_com', false);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'OpenAI (Telegram)', 'telegram', 'https://t.me/openai', 'openai', false);

      -- ─── MARKETING ───
      ELSIF ag_subject_area = 'marketing' THEN
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Cossa', 'rss', 'https://www.cossa.ru/rss/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'vc.ru — Маркетинг', 'rss', 'https://vc.ru/rss', NULL, false);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Search Engine Land', 'rss', 'https://searchengineland.com/feed', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'HubSpot Marketing Blog', 'rss', 'https://blog.hubspot.com/marketing/rss.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Social Media Examiner', 'rss', 'https://www.socialmediaexaminer.com/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'MarketingProfs', 'rss', 'https://www.marketingprofs.com/rss/all', NULL, false);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'vc.ru (Telegram)', 'telegram', 'https://t.me/vcru', 'vcru', true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Cossa (Telegram)', 'telegram', 'https://t.me/cossa_ru', 'cossa_ru', true);

      -- ─── MEDICAL ───
      ELSIF ag_subject_area = 'medical' THEN
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'WHO News', 'rss', 'https://www.who.int/rss-feeds/news-english.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'NIH News Releases', 'rss', 'https://www.nih.gov/news-events/news-releases/feed.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'ScienceDaily — Health & Medicine', 'rss', 'https://www.sciencedaily.com/rss/health_medicine.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Medical Xpress — Medicine News', 'rss', 'https://medicalxpress.com/rss-feed/medicine-news/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Medscape', 'rss', 'https://www.medscape.com/rss', NULL, false);

      -- ─── DESIGN ───
      ELSIF ag_subject_area = 'design' THEN
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Smashing Magazine', 'rss', 'https://www.smashingmagazine.com/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'UX Collective', 'rss', 'https://uxdesign.cc/feed', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Creative Bloq', 'rss', 'https://www.creativebloq.com/feeds.xml', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'AIGA Eye on Design', 'rss', 'https://eyeondesign.aiga.org/feed/', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Design Milk', 'rss', 'https://design-milk.com/feed/', NULL, false);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Хабр — Дизайн', 'rss', 'https://habr.com/ru/rss/hubs/design/articles/?fl=ru', NULL, true);
        PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Awdee (Telegram)', 'telegram', 'https://t.me/awdee', 'awdee', true);
      END IF;

    END LOOP;
  END LOOP;
END;
$$;

-- Step 3: Clean up helper function
DROP FUNCTION _nr_insert_source_and_link(UUID, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN);
