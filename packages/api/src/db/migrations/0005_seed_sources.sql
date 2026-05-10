-- ------------------------------------------------------------
-- Seed data: sources + agent_sources
-- Predefined RSS/Telegram sources for each subject area
-- Date: 2026-05-09
-- ------------------------------------------------------------

DO $$
DECLARE
  ws_id uuid;
  aid  uuid;
  sid  uuid;
BEGIN
  -- Marina's workspace
  SELECT id INTO ws_id FROM workspaces WHERE id = '05000f1f-4df4-4409-8318-fefd75153773';
  IF ws_id IS NULL THEN
    RAISE NOTICE 'Workspace not found - aborting sources seed';
    RETURN;
  END IF;

  -- Clean up existing data (idempotent)
  DELETE FROM agent_sources WHERE source_id IN (SELECT id FROM sources WHERE workspace_id = ws_id);
  DELETE FROM sources WHERE workspace_id = ws_id;

  -- infosec - CyberSec Monitor
  SELECT id INTO aid FROM agents WHERE workspace_id = ws_id AND subject_area = 'infosec';

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'KrebsOnSecurity',       'https://krebsonsecurity.com/feed/',          ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'The Hacker News',       'https://thehackernews.com/feed/',            ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'BleepingComputer',      'https://www.bleepingcomputer.com/feed/',     ws_id, '0 */4 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'NVD - National Vulnerability Database', 'https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-recent.json.gz', ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Dark Reading',          'https://darkreading.com/rss_simple.asp',      ws_id, '0 */8 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'SecurityWeek',          'https://www.securityweek.com/rss.xml',        ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  -- ai - AI Analyst
  SELECT id INTO aid FROM agents WHERE workspace_id = ws_id AND subject_area = 'ai';

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'MIT Technology Review AI', 'https://www.technologyreview.com/feed/simple/the-download/', ws_id, '0 */4 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'VentureBeat AI',         'https://venturebeat.com/ai/feed/',          ws_id, '0 */4 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'The Batch - Andrew Ng',  'https://www.deeplearning.ai/the-batch/feed/', ws_id, '0 8 * * *',    '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Synced Review',         'https://syncedreview.com/feed/',             ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Arxiv AI',              'http://export.arxiv.org/rss/cs.AI',           ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  -- marketing - Marketing Tracker
  SELECT id INTO aid FROM agents WHERE workspace_id = ws_id AND subject_area = 'marketing';

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Marketing Land',        'https://marketingland.com/feed/',            ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Social Media Examiner',  'https://www.socialmediaexaminer.com/feed/',   ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'HubSpot Blog',          'https://blog.hubspot.com/marketing/feed',     ws_id, '0 */8 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Moz Blog',              'https://moz.com/blog/feed',                   ws_id, '0 */8 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Neil Patel Blog',       'https://neilpatel.com/blog/feed/',            ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  -- medical - Health Watch
  SELECT id INTO aid FROM agents WHERE workspace_id = ws_id AND subject_area = 'medical';

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'WHO Newsroom',          'https://www.who.int/feed/v2/entity/c89359a4-8f62-4705-8e77-0fd5a6fce8e9?language=en', ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Medical News Today',    'https://www.medicalnewstoday.com/rss/latestnews', ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Healthline News',       'https://www.healthline.com/health-news/rss',   ws_id, '0 */6 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'STAT News',             'https://www.statnews.com/feed/',              ws_id, '0 */4 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'PubMed New',            'https://pubmed.ncbi.nlm.nih.gov/rss/search/1n5izptRZTJhQndtQVdEUVVNUJJQT005/?format=atom', ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  -- design - Design Digest
  SELECT id INTO aid FROM agents WHERE workspace_id = ws_id AND subject_area = 'design';

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Smashing Magazine',     'https://www.smashingmagazine.com/feed/',      ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'A List Apart',          'https://alistapart.com/feed/',                ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'UX Collective',         'https://uxdesign.cc/feed/',                   ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Creative Bloq',         'https://www.creativebloq.com/feed',            ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  INSERT INTO sources (id, type, name, url, workspace_id, fetch_schedule, health) VALUES
    (gen_random_uuid(), 'rss', 'Dribbble Blog',         'https://dribbble.com/shots/popular.rss',      ws_id, '0 */12 * * *', '{}')
  RETURNING id INTO sid;
  INSERT INTO agent_sources (agent_id, source_id) VALUES (aid, sid);

  RAISE NOTICE 'Seed: sources + agent_links created for workspace %', ws_id;
END $$;