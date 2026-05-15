-- Migration 0004: Deduplicate agents and seed new ones
-- Uses CTEs only, no temp tables. Safe for transactional execution.

-- ============================================================
-- STEP 1: Add missing subject areas
-- ============================================================
INSERT INTO subject_areas (id, label, icon, color, default_topic, default_audience, defaults_json, position)
VALUES
  ('construction', 'Строительство и ремонт', 'hammer', '#f59e0b', 'Строительство, ремонт, архитектура', 'Строители, архитекторы, дизайнеры', '{"tone":"экспертный"}', 5),
  ('devops', 'Free DevOps & Инжиниринг', 'wrench', '#10b981', 'DevOps, SRE, облачные технологии', 'DevOps-инженеры, SRE', '{"tone":"экспертный"}', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: Merge duplicate agents per workspace
-- Strategy: For each workspace, keep the FIRST agent per subject_area
-- (ordered by created_at). Transfer sources from duplicates.
-- ============================================================

-- Transfer agent_sources from duplicates to the kept agent
WITH keepers AS (
  SELECT DISTINCT ON (workspace_id, COALESCE(subject_area, ''))
    id AS keep_id, workspace_id, subject_area
  FROM agents
  ORDER BY workspace_id, COALESCE(subject_area, ''), created_at ASC
),
dupes AS (
  SELECT a.id AS dupe_id, k.keep_id
  FROM agents a
  JOIN keepers k ON a.workspace_id = k.workspace_id
    AND COALESCE(a.subject_area, '') = COALESCE(k.subject_area, '')
  WHERE a.id != k.keep_id
)
INSERT INTO agent_sources (agent_id, source_id)
SELECT d.keep_id, asrc.source_id
FROM agent_sources asrc
JOIN dupes d ON asrc.agent_id = d.dupe_id
ON CONFLICT (agent_id, source_id) DO NOTHING;

-- Transfer articles from duplicates to the kept agent
WITH keepers AS (
  SELECT DISTINCT ON (workspace_id, COALESCE(subject_area, ''))
    id AS keep_id, workspace_id, subject_area
  FROM agents
  ORDER BY workspace_id, COALESCE(subject_area, ''), created_at ASC
),
dupes AS (
  SELECT a.id AS dupe_id, k.keep_id
  FROM agents a
  JOIN keepers k ON a.workspace_id = k.workspace_id
    AND COALESCE(a.subject_area, '') = COALESCE(k.subject_area, '')
  WHERE a.id != k.keep_id
)
UPDATE articles SET agent_id = d.keep_id
FROM dupes d
WHERE articles.agent_id = d.dupe_id;

-- Remove agent_sources for duplicates
WITH keepers AS (
  SELECT DISTINCT ON (workspace_id, COALESCE(subject_area, ''))
    id AS keep_id, workspace_id, subject_area
  FROM agents
  ORDER BY workspace_id, COALESCE(subject_area, ''), created_at ASC
),
dupes AS (
  SELECT a.id AS dupe_id
  FROM agents a
  JOIN keepers k ON a.workspace_id = k.workspace_id
    AND COALESCE(a.subject_area, '') = COALESCE(k.subject_area, '')
  WHERE a.id != k.keep_id
)
DELETE FROM agent_sources WHERE agent_id IN (SELECT dupe_id FROM dupes);

-- Delete duplicate agents
WITH keepers AS (
  SELECT DISTINCT ON (workspace_id, COALESCE(subject_area, ''))
    id AS keep_id, workspace_id, subject_area
  FROM agents
  ORDER BY workspace_id, COALESCE(subject_area, ''), created_at ASC
),
dupes AS (
  SELECT a.id AS dupe_id
  FROM agents a
  JOIN keepers k ON a.workspace_id = k.workspace_id
    AND COALESCE(a.subject_area, '') = COALESCE(k.subject_area, '')
  WHERE a.id != k.keep_id
)
DELETE FROM agents WHERE id IN (SELECT dupe_id FROM dupes);

-- ============================================================
-- STEP 3: Add missing agents for workspaces that don't have them
-- ============================================================

-- Construction agent
INSERT INTO agents (name, description, icon, color, workspace_id, subject_area, config, position)
SELECT 'Строительство и ремонт', 'Мониторинг новостей строительства и архитектуры', 'hammer', '#f59e0b', w.id, 'construction',
  '{"targetAudience":"Строители, архитекторы","tone":"экспертный","scoringWeights":{"aiRelevance":0.35,"keywordMatch":0.25,"freshness":0.20,"sourceTrust":0.20}}', 5
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE workspace_id = w.id AND subject_area = 'construction');

-- DevOps agent
INSERT INTO agents (name, description, icon, color, workspace_id, subject_area, config, position)
SELECT 'Free DevOps & Инжиниринг', 'Мониторинг DevOps, SRE и облачных технологий', 'wrench', '#10b981', w.id, 'devops',
  '{"targetAudience":"DevOps-инженеры, SRE","tone":"экспертный","scoringWeights":{"aiRelevance":0.35,"keywordMatch":0.25,"freshness":0.20,"sourceTrust":0.20}}', 6
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM agents WHERE workspace_id = w.id AND subject_area = 'devops');

-- ============================================================
-- STEP 4: Create scoring criteria for new agents
-- ============================================================
INSERT INTO scoring_criteria (agent_id, criterion_type, label, weight, position, is_active, config)
SELECT a.id, ct.ctype, ct.clabel, ct.cweight, ct.cpos, true, '{}'
FROM agents a
CROSS JOIN (VALUES
  ('ai_relevance', 'AI-релевантность', '0.3500', 0),
  ('keyword_match', 'Совпадение ключевых слов', '0.2500', 1),
  ('freshness', 'Свежесть', '0.2000', 2),
  ('source_trust', 'Доверие к источнику', '0.2000', 3)
) AS ct(ctype, clabel, cweight, cpos)
WHERE a.subject_area IN ('construction', 'devops')
AND NOT EXISTS (
  SELECT 1 FROM scoring_criteria sc
  WHERE sc.agent_id = a.id AND sc.criterion_type = ct.ctype
);

-- ============================================================
-- STEP 5: Seed sources for construction agents
-- ============================================================
INSERT INTO sources (type, name, url, workspace_id, is_active, fetch_count)
SELECT 'rss', s.name, s.url, a.workspace_id, true, 0
FROM agents a
CROSS JOIN (VALUES
  ('Архитектура и строительство', 'https://habr.com/ru/rss/hubs/construction/articles/?fl=ru'),
  ('ArchDaily', 'https://www.archdaily.com/feed'),
  ('Dezeen Architecture', 'https://www.dezeen.com/architecture/feed/'),
  ('The Architect Newspaper', 'https://archpaper.com/feed/')
) AS s(name, url)
WHERE a.subject_area = 'construction'
AND NOT EXISTS (
  SELECT 1 FROM sources WHERE url = s.url AND workspace_id = a.workspace_id
);

INSERT INTO agent_sources (agent_id, source_id)
SELECT a.id, s.id
FROM agents a
JOIN sources s ON s.workspace_id = a.workspace_id
WHERE a.subject_area = 'construction'
AND s.url IN (
  'https://habr.com/ru/rss/hubs/construction/articles/?fl=ru',
  'https://www.archdaily.com/feed',
  'https://www.dezeen.com/architecture/feed/',
  'https://archpaper.com/feed/'
)
ON CONFLICT (agent_id, source_id) DO NOTHING;

-- ============================================================
-- STEP 6: Seed sources for devops agents
-- ============================================================
INSERT INTO sources (type, name, url, workspace_id, is_active, fetch_count)
SELECT 'rss', s.name, s.url, a.workspace_id, true, 0
FROM agents a
CROSS JOIN (VALUES
  ('Хабр — DevOps', 'https://habr.com/ru/rss/hubs/devops/articles/?fl=ru'),
  ('DevOps.com', 'https://devops.com/feed/'),
  ('The New Stack', 'https://thenewstack.io/feed/'),
  ('Kubernetes Blog', 'https://kubernetes.io/feed.xml'),
  ('Docker Blog', 'https://www.docker.com/blog/feed/')
) AS s(name, url)
WHERE a.subject_area = 'devops'
AND NOT EXISTS (
  SELECT 1 FROM sources WHERE url = s.url AND workspace_id = a.workspace_id
);

INSERT INTO agent_sources (agent_id, source_id)
SELECT a.id, s.id
FROM agents a
JOIN sources s ON s.workspace_id = a.workspace_id
WHERE a.subject_area = 'devops'
AND s.url IN (
  'https://habr.com/ru/rss/hubs/devops/articles/?fl=ru',
  'https://devops.com/feed/',
  'https://thenewstack.io/feed/',
  'https://kubernetes.io/feed.xml',
  'https://www.docker.com/blog/feed/'
)
ON CONFLICT (agent_id, source_id) DO NOTHING;

-- ============================================================
-- STEP 7: Seed default OpenRouter provider
-- ============================================================
INSERT INTO ai_providers (name, type, provider, base_url, model, is_active, workspace_id)
SELECT 'OpenRouter (default)', 'platform', 'openrouter', 'https://openrouter.ai/api/v1', 'openrouter/auto', true, w.id
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM ai_providers WHERE workspace_id = w.id AND provider = 'openrouter'
);
