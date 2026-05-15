-- Migration 0004: Deduplicate agents, add missing agents, seed new sources
-- Idempotent: safe to run multiple times

-- ============================================================
-- STEP 1: Add missing subject areas
-- ============================================================
INSERT INTO subject_areas (id, label, icon, color, default_topic, default_audience, defaults_json, position)
VALUES
  ('construction', 'Строительство и ремонт', 'hammer', '#f59e0b', 'Строительство, ремонт, архитектура, недвижимость', 'Строители, архитекторы, дизайнеры интерьеров, владельцы недвижимости', '{"tone":"экспертный","tags":["строительство","ремонт","архитектура","недвижимость"]}', 5),
  ('devops', 'Free DevOps & Инжиниринг', 'wrench', '#10b981', 'DevOps, SRE, платформенная инженерия, облачные технологии', 'DevOps-инженеры, SRE, платформенные инженеры, разработчики', '{"tone":"экспертный","tags":["devops","sre","kubernetes","docker","ci/cd","облако"]}', 6)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 2: Deduplicate agents per workspace
-- For each workspace, find agents with same subject_area or similar name
-- Keep the one with most articles, merge sources from duplicates
-- ============================================================

-- Create temp table with agents to keep (one per subject_area per workspace)
CREATE TEMP TABLE agents_to_keep AS
SELECT DISTINCT ON (workspace_id, COALESCE(subject_area, id::text))
  id as keep_id,
  workspace_id,
  subject_area,
  name
FROM agents
WHERE is_active = true OR is_active IS NULL
ORDER BY workspace_id, COALESCE(subject_area, id::text), created_at ASC;

-- Create temp table with agents to remove (duplicates)
CREATE TEMP TABLE agents_to_remove AS
SELECT a.id as remove_id, a.workspace_id, a.subject_area, a.name
FROM agents a
LEFT JOIN agents_to_keep atk ON a.id = atk.keep_id
WHERE atk.keep_id IS NULL;

-- Transfer sources from duplicate agents to the kept agent (same workspace + subject_area)
INSERT INTO agent_sources (agent_id, source_id)
SELECT atk.keep_id, asrc.source_id
FROM agent_sources asrc
JOIN agents_to_remove atr ON asrc.agent_id = atr.remove_id
JOIN agents_to_keep atk ON atr.workspace_id = atk.workspace_id AND COALESCE(atr.subject_area, '') = COALESCE(atk.subject_area, '')
ON CONFLICT (agent_id, source_id) DO NOTHING;

-- Transfer articles from duplicate agents to the kept agent
UPDATE articles
SET agent_id = atk.keep_id
FROM agents_to_remove atr
JOIN agents_to_keep atk ON articles.workspace_id = atk.workspace_id AND COALESCE(atr.subject_area, '') = COALESCE(atk.subject_area, '')
WHERE articles.agent_id = atr.remove_id;

-- Remove orphaned agent_sources for duplicates
DELETE FROM agent_sources WHERE agent_id IN (SELECT remove_id FROM agents_to_remove);

-- Remove duplicate agents
DELETE FROM agents WHERE id IN (SELECT remove_id FROM agents_to_remove);

DROP TABLE IF EXISTS agents_to_keep;
DROP TABLE IF EXISTS agents_to_remove;

-- ============================================================
-- STEP 3: Add missing default agents per workspace
-- For each workspace, add agents for subject areas that don't exist yet
-- ============================================================

-- Add Строительство и ремонт agent for workspaces that don't have one
INSERT INTO agents (name, description, icon, color, workspace_id, subject_area, config, position)
SELECT
  'Строительство и ремонт',
  'Мониторинг новостей строительства, ремонта, архитектуры и недвижимости',
  'hammer',
  '#f59e0b',
  w.id,
  'construction',
  '{"targetAudience":"Строители, архитекторы, дизайнеры интерьеров","tone":"экспертный","tags":["строительство","ремонт","архитектура","недвижимость"],"scoringWeights":{"aiRelevance":0.35,"keywordMatch":0.25,"freshness":0.20,"sourceTrust":0.20}}',
  5
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM agents WHERE workspace_id = w.id AND subject_area = 'construction'
);

-- Add Free DevOps & Инжиниринг agent for workspaces that don't have one
INSERT INTO agents (name, description, icon, color, workspace_id, subject_area, config, position)
SELECT
  'Free DevOps & Инжиниринг',
  'Мониторинг DevOps, SRE, платформенной инженерии и облачных технологий',
  'wrench',
  '#10b981',
  w.id,
  'devops',
  '{"targetAudience":"DevOps-инженеры, SRE, платформенные инженеры","tone":"экспертный","tags":["devops","sre","kubernetes","docker","ci/cd","облако"],"scoringWeights":{"aiRelevance":0.35,"keywordMatch":0.25,"freshness":0.20,"sourceTrust":0.20}}',
  6
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM agents WHERE workspace_id = w.id AND subject_area = 'devops'
);

-- ============================================================
-- STEP 4: Create default scoring criteria for new agents
-- ============================================================
INSERT INTO scoring_criteria (agent_id, criterion_type, label, weight, position, is_active, config)
SELECT a.id, 'ai_relevance', 'AI-релевантность', '0.3500', 0, true, '{}'
FROM agents a
WHERE a.subject_area IN ('construction', 'devops')
AND NOT EXISTS (SELECT 1 FROM scoring_criteria WHERE agent_id = a.id AND criterion_type = 'ai_relevance');

INSERT INTO scoring_criteria (agent_id, criterion_type, label, weight, position, is_active, config)
SELECT a.id, 'keyword_match', 'Совпадение ключевых слов', '0.2500', 1, true, '{}'
FROM agents a
WHERE a.subject_area IN ('construction', 'devops')
AND NOT EXISTS (SELECT 1 FROM scoring_criteria WHERE agent_id = a.id AND criterion_type = 'keyword_match');

INSERT INTO scoring_criteria (agent_id, criterion_type, label, weight, position, is_active, config)
SELECT a.id, 'freshness', 'Свежесть', '0.2000', 2, true, '{}'
FROM agents a
WHERE a.subject_area IN ('construction', 'devops')
AND NOT EXISTS (SELECT 1 FROM scoring_criteria WHERE agent_id = a.id AND criterion_type = 'freshness');

INSERT INTO scoring_criteria (agent_id, criterion_type, label, weight, position, is_active, config)
SELECT a.id, 'source_trust', 'Доверие к источнику', '0.2000', 3, true, '{}'
FROM agents a
WHERE a.subject_area IN ('construction', 'devops')
AND NOT EXISTS (SELECT 1 FROM scoring_criteria WHERE agent_id = a.id AND criterion_type = 'source_trust');

-- ============================================================
-- STEP 5: Seed sources for new subject areas
-- ============================================================

-- Construction sources
INSERT INTO sources (type, name, url, workspace_id, is_active, fetch_count)
SELECT 'rss', s.name, s.url, w.id, true, 0
FROM workspaces w
CROSS JOIN (VALUES
  ('Архитектура и строительство', 'https://habr.com/ru/rss/hubs/construction/articles/?fl=ru'),
  ('Строительство и недвижимость', 'https://www.cian.ru/feed/'),
  ('ArchDaily', 'https://www.archdaily.com/feed'),
  ('Dezeen — Architecture', 'https://www.dezeen.com/architecture/feed/'),
  ('The Architect''s Newspaper', 'https://archpaper.com/feed/')
) AS s(name, url)
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE url = s.url AND workspace_id = w.id
);

-- Link construction sources to construction agents
INSERT INTO agent_sources (agent_id, source_id)
SELECT a.id, s.id
FROM agents a
JOIN sources s ON s.workspace_id = a.workspace_id
WHERE a.subject_area = 'construction'
AND s.url IN (
  'https://habr.com/ru/rss/hubs/construction/articles/?fl=ru',
  'https://www.cian.ru/feed/',
  'https://www.archdaily.com/feed',
  'https://www.dezeen.com/architecture/feed/',
  'https://archpaper.com/feed/'
)
ON CONFLICT (agent_id, source_id) DO NOTHING;

-- DevOps sources
INSERT INTO sources (type, name, url, workspace_id, is_active, fetch_count)
SELECT 'rss', s.name, s.url, w.id, true, 0
FROM workspaces w
CROSS JOIN (VALUES
  ('Хабр — DevOps', 'https://habr.com/ru/rss/hubs/devops/articles/?fl=ru'),
  ('DevOps.com', 'https://devops.com/feed/'),
  ('The New Stack', 'https://thenewstack.io/feed/'),
  ('Kubernetes Blog', 'https://kubernetes.io/feed.xml'),
  ('Docker Blog', 'https://www.docker.com/blog/feed/'),
  ('Hacker News — DevOps', 'https://hnrss.org/newest?q=DevOps+OR+Kubernetes+OR+Docker+OR+SRE')
) AS s(name, url)
WHERE NOT EXISTS (
  SELECT 1 FROM sources WHERE url = s.url AND workspace_id = w.id
);

-- Link devops sources to devops agents
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
  'https://www.docker.com/blog/feed/',
  'https://hnrss.org/newest?q=DevOps+OR+Kubernetes+OR+Docker+OR+SRE'
)
ON CONFLICT (agent_id, source_id) DO NOTHING;

-- ============================================================
-- STEP 7: Seed default OpenRouter AI provider for workspaces that have none
-- ============================================================
INSERT INTO ai_providers (name, type, provider, base_url, model, is_active, workspace_id)
SELECT 'OpenRouter (default)', 'platform', 'openrouter', 'https://openrouter.ai/api/v1', 'openrouter/auto', true, w.id
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM ai_providers WHERE workspace_id = w.id AND provider = 'openrouter'
);

-- Construction chip filters
INSERT INTO chip_filters (agent_id, key, label, description, pattern, operator, score_modifier, color, is_active, position)
SELECT a.id, cf.key, cf.label, cf.description, cf.pattern, cf.operator, cf.score_modifier, cf.color, true, cf.pos
FROM agents a
CROSS JOIN (VALUES
  ('critical_object', 'Крупный объект', 'Строительство крупных объектов', '(мост|стадион|метростро|ЖК|комплекс|небоскрёб)', 'regex', '0.15', '#ef4444', 0),
  ('practical_guide', 'Практический разбор', 'Пошаговые инструкции и кейсы', '(как сделать|пошаг|туториал|практик|кейс|рецепт)', 'regex', '0.10', '#0ea5e9', 1),
  ('materials_tech', 'Материалы и технологии', 'Новые стройматериалы и технологии', '(материал|технологи|инновац|энергоэффективн|утепл)', 'regex', '0.08', '#8b5cf6', 2),
  ('noise', 'Шум / общие рассуждения', 'Непрактичные обзоры', '(просто красиво|вдохновение без кейса|мотивация)', 'regex', '-0.10', '#64748b', 3)
) AS cf(key, label, description, pattern, operator, score_modifier, color, pos)
WHERE a.subject_area = 'construction'
AND NOT EXISTS (SELECT 1 FROM chip_filters WHERE agent_id = a.id AND key = cf.key);

-- DevOps chip filters
INSERT INTO chip_filters (agent_id, key, label, description, pattern, operator, score_modifier, color, is_active, position)
SELECT a.id, cf.key, cf.label, cf.description, cf.pattern, cf.operator, cf.score_modifier, cf.color, true, cf.pos
FROM agents a
CROSS JOIN (VALUES
  ('new_release', 'Новый релиз / инструмент', 'Выход новых версий и инструментов', '(release|v[0-9]|announces|выпустила|релиз|open source)', 'regex', '0.12', '#2563eb', 0),
  ('production_case', 'Production-кейс', 'Реальные кейсы внедрения', '(production|кейс|внедрен|case study|war story|postmortem)', 'regex', '0.10', '#0ea5e9', 1),
  ('k8s_cloud', 'Kubernetes / Cloud', 'Kubernetes и облачные технологии', '(kubernetes|k8s|helm|istio|AWS|GCP|Azure|terraform|cloud)', 'regex', '0.08', '#8b5cf6', 2),
  ('hype_without_details', 'Хайп без деталей', 'Громкие заголовки без технических подробностей', '(революция|будущее|шок|сенсация|убьёт|заменит без деталей)', 'regex', '-0.10', '#64748b', 3)
) AS cf(key, label, description, pattern, operator, score_modifier, color, pos)
WHERE a.subject_area = 'devops'
AND NOT EXISTS (SELECT 1 FROM chip_filters WHERE agent_id = a.id AND key = cf.key);
