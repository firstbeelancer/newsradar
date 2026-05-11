-- ─────────────────────────────────────────────────────────────
-- Migration 0007: Hybrid 5+4 Scoring Model
-- - Add AI sub-criteria columns to article_scores
-- - Add meta-weight columns to workspace_scoring_config
-- - Add 2 new subject areas: construction, devops
-- - Update existing subject areas with new defaultsJson format
-- Date: 2026-05-15
-- ─────────────────────────────────────────────────────────────

-- 1. Add AI sub-criteria columns to article_scores
ALTER TABLE "article_scores"
  ADD COLUMN IF NOT EXISTS "relevance" decimal(5,2),
  ADD COLUMN IF NOT EXISTS "novelty" decimal(5,2),
  ADD COLUMN IF NOT EXISTS "hype" decimal(5,2),
  ADD COLUMN IF NOT EXISTS "practical" decimal(5,2),
  ADD COLUMN IF NOT EXISTS "local" decimal(5,2);

-- 2. Add meta-weight columns to workspace_scoring_config
-- These represent the 4 outer weights: ai_score, keyword_score, freshness_score, source_trust_score
ALTER TABLE "workspace_scoring_config"
  ADD COLUMN IF NOT EXISTS "ai_weight" decimal(5,4) DEFAULT '0.5500' NOT NULL,
  ADD COLUMN IF NOT EXISTS "keyword_weight" decimal(5,4) DEFAULT '0.2000' NOT NULL,
  ADD COLUMN IF NOT EXISTS "freshness_weight" decimal(5,4) DEFAULT '0.1500' NOT NULL,
  ADD COLUMN IF NOT EXISTS "source_trust_weight" decimal(5,4) DEFAULT '0.1000' NOT NULL;

-- 3. Add scoring_weights JSONB column to workspace_scoring_config for 5 AI criteria weights
ALTER TABLE "workspace_scoring_config"
  ADD COLUMN IF NOT EXISTS "scoring_weights" jsonb DEFAULT '{}' NOT NULL;

-- Set default scoring_weights for existing rows
UPDATE "workspace_scoring_config"
SET "scoring_weights" = '{"relevance":30,"novelty":25,"hype":15,"practical":20,"local":10}'::jsonb
WHERE "scoring_weights" = '{}'::jsonb OR "scoring_weights" IS NULL;

-- 4. Update existing subject areas with new defaultsJson format
-- Infosec
UPDATE "subject_areas" SET "defaults_json" = '{
  "scoring_weights": {"relevance": 35, "novelty": 20, "hype": 10, "practical": 25, "local": 10},
  "chip_filters": [
    {"key": "critical_vuln", "label": "Критическая уязвимость", "score_modifier": 15, "color": "danger"},
    {"key": "zero_day", "label": "Zero-day", "score_modifier": 20, "color": "danger"},
    {"key": "apt", "label": "APT-атака", "score_modifier": 10, "color": "warning"},
    {"key": "ransomware", "label": "Ransomware", "score_modifier": 10, "color": "warning"},
    {"key": "noise", "label": "Шум/реклама", "score_modifier": -15, "color": "muted"}
  ],
  "default_sources": [
    {"type": "rss", "name": "Habr Information Security", "url": "https://habr.com/ru/hub/infosecurity/rss/"},
    {"type": "rss", "name": "The Hacker News", "url": "https://feeds.feedburner.com/TheHackersNews"},
    {"type": "rss", "name": "BleepingComputer", "url": "https://www.bleepingcomputer.com/feed/"},
    {"type": "rss", "name": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/"},
    {"type": "rss", "name": "Securelist", "url": "https://securelist.com/feed/"},
    {"type": "rss", "name": "Negative Space (RU)", "url": "https://nagg.ru/feed/"}
  ]
}'::jsonb WHERE "id" = 'infosec';

-- AI
UPDATE "subject_areas" SET "defaults_json" = '{
  "scoring_weights": {"relevance": 35, "novelty": 25, "hype": 10, "practical": 20, "local": 10},
  "chip_filters": [
    {"key": "llm", "label": "LLM", "score_modifier": 10, "color": "accent"},
    {"key": "foundation_model", "label": "Foundation Model", "score_modifier": 10, "color": "accent"},
    {"key": "rag", "label": "RAG", "score_modifier": 10, "color": "primary"},
    {"key": "fine_tuning", "label": "Fine-tuning", "score_modifier": 8, "color": "primary"},
    {"key": "noise", "label": "Шум/реклама", "score_modifier": -15, "color": "muted"}
  ],
  "default_sources": [
    {"type": "rss", "name": "Habr AI", "url": "https://habr.com/ru/hub/artificial_intelligence/rss/"},
    {"type": "rss", "name": "OpenAI Blog", "url": "https://openai.com/blog/rss.xml"},
    {"type": "rss", "name": "AI News", "url": "https://artificialintelligence-news.com/feed/"},
    {"type": "rss", "name": "MIT Technology Review AI", "url": "https://www.technologyreview.com/feed/"},
    {"type": "rss", "name": "DeepMind Blog", "url": "https://deepmind.com/blog/feed/"},
    {"type": "rss", "name": "AI Russia", "url": "https://ai.ru/feed"}
  ]
}'::jsonb WHERE "id" = 'ai';

-- Marketing
UPDATE "subject_areas" SET "defaults_json" = '{
  "scoring_weights": {"relevance": 30, "novelty": 20, "hype": 15, "practical": 25, "local": 10},
  "chip_filters": [
    {"key": "seo", "label": "SEO", "score_modifier": 10, "color": "success"},
    {"key": "ppc", "label": "PPC/Контекст", "score_modifier": 10, "color": "success"},
    {"key": "content_marketing", "label": "Контент-маркетинг", "score_modifier": 8, "color": "primary"},
    {"key": "influencer", "label": "Инфлюенсеры", "score_modifier": 5, "color": "warning"},
    {"key": "noise", "label": "Шум/реклама", "score_modifier": -15, "color": "muted"}
  ],
  "default_sources": [
    {"type": "rss", "name": "Habr Marketing", "url": "https://habr.com/ru/hub/marketing/rss/"},
    {"type": "rss", "name": "Search Engine Journal", "url": "https://www.searchenginejournal.com/feed/"},
    {"type": "rss", "name": "Marketing Land", "url": "https://marketingland.com/feed/"},
    {"type": "rss", "name": "Sostav", "url": "https://www.sostav.ru/rss/"},
    {"type": "rss", "name": "Cossa", "url": "https://www.cossa.ru/rss/"}
  ]
}'::jsonb WHERE "id" = 'marketing';

-- Medical
UPDATE "subject_areas" SET "defaults_json" = '{
  "scoring_weights": {"relevance": 35, "novelty": 20, "hype": 10, "practical": 25, "local": 10},
  "chip_filters": [
    {"key": "clinical_trials", "label": "Клинические испытания", "score_modifier": 15, "color": "primary"},
    {"key": "telemedicine", "label": "Телемедицина", "score_modifier": 10, "color": "accent"},
    {"key": "ehealth", "label": "eHealth", "score_modifier": 10, "color": "success"},
    {"key": "pharma", "label": "Фармацевтика", "score_modifier": 8, "color": "warning"},
    {"key": "noise", "label": "Шум/реклама", "score_modifier": -15, "color": "muted"}
  ],
  "default_sources": [
    {"type": "rss", "name": "MedTech", "url": "https://medtech.md/feed/"},
    {"type": "rss", "name": "Medical Xpress", "url": "https://medicalxpress.com/rss/"},
    {"type": "rss", "name": "HIMSS", "url": "https://www.himss.org/rss"},
    {"type": "rss", "name": "Remedium", "url": "https://remedium.ru/rss/"},
    {"type": "rss", "name": "VrachRF", "url": "https://vrachrf.ru/feed/"}
  ]
}'::jsonb WHERE "id" = 'medical';

-- Design
UPDATE "subject_areas" SET "defaults_json" = '{
  "scoring_weights": {"relevance": 25, "novelty": 25, "hype": 15, "practical": 25, "local": 10},
  "chip_filters": [
    {"key": "ui_ux", "label": "UI/UX", "score_modifier": 10, "color": "accent"},
    {"key": "graphic_design", "label": "Графический дизайн", "score_modifier": 10, "color": "primary"},
    {"key": "motion", "label": "Motion-дизайн", "score_modifier": 8, "color": "warning"},
    {"key": "branding", "label": "Брендинг", "score_modifier": 8, "color": "success"},
    {"key": "noise", "label": "Шум/реклама", "score_modifier": -15, "color": "muted"}
  ],
  "default_sources": [
    {"type": "rss", "name": "Habr Design", "url": "https://habr.com/ru/hub/design/rss/"},
    {"type": "rss", "name": "Smashing Magazine", "url": "https://www.smashingmagazine.com/feed/"},
    {"type": "rss", "name": "UX Collective", "url": "https://uxdesign.cc/feed"},
    {"type": "rss", "name": "Dribbble Blog", "url": "https://dribbble.com/stories/feed"},
    {"type": "rss", "name": "Design Informer", "url": "https://designinformer.com/feed/"}
  ]
}'::jsonb WHERE "id" = 'design';

-- 5. Insert 2 new subject areas

-- Строительство и ремонт
INSERT INTO "subject_areas" ("id", "label", "icon", "color", "default_topic", "default_audience", "defaults_json", "position")
VALUES (
  'construction',
  'Строительство и ремонт',
  'hammer',
  '#a855f7',
  'Строительство, ремонт и отделка',
  'Строители, прорабы, дизайнеры интерьеров, владельцы квартир',
  '{
    "scoring_weights": {"relevance": 30, "novelty": 20, "hype": 10, "practical": 30, "local": 10},
    "chip_filters": [
      {"key": "new_material", "label": "Новые материалы", "score_modifier": 12, "color": "accent"},
      {"key": "practical_tip", "label": "Практический совет", "score_modifier": 15, "color": "success"},
      {"key": "snip_norms", "label": "Нормы/СНиП", "score_modifier": 10, "color": "primary"},
      {"key": "noise", "label": "Шум/реклама", "score_modifier": -15, "color": "muted"}
    ],
    "default_sources": [
      {"type": "rss", "name": "Stroychik", "url": "https://stroychik.ru/feed/"},
      {"type": "rss", "name": "ForumHouse", "url": "https://www.forumhouse.ru/feed/"},
      {"type": "rss", "name": "Remontnik", "url": "https://remontnik.ru/feed/"},
      {"type": "rss", "name": "Stroy-Svoy-Dom", "url": "https://stroysvoydom.ru/feed/"},
      {"type": "rss", "name": "Decker Report", "url": "https://www.deckreport.net/feed/"},
      {"type": "rss", "name": "Construction Dive", "url": "https://www.constructiondive.com/feed/"}
    ]
  }'::jsonb,
  5
) ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "icon" = EXCLUDED."icon",
  "color" = EXCLUDED."color",
  "default_topic" = EXCLUDED."default_topic",
  "default_audience" = EXCLUDED."default_audience",
  "defaults_json" = EXCLUDED."defaults_json",
  "position" = EXCLUDED."position",
  "updated_at" = now();

-- Free DevOps и инжиниринг
INSERT INTO "subject_areas" ("id", "label", "icon", "color", "default_topic", "default_audience", "defaults_json", "position")
VALUES (
  'devops',
  'Free DevOps и инжиниринг',
  'server',
  '#06b6d4',
  'Open-source и freemium инфраструктурные инструменты',
  'DevOps-инженеры, системные администраторы, SRE, CTO',
  '{
    "scoring_weights": {"relevance": 30, "novelty": 25, "hype": 10, "practical": 25, "local": 10},
    "chip_filters": [
      {"key": "opensource_release", "label": "Open-source релиз", "score_modifier": 15, "color": "success"},
      {"key": "practical_guide", "label": "Практический гайд", "score_modifier": 12, "color": "accent"},
      {"key": "production_ready", "label": "Production-ready", "score_modifier": 10, "color": "primary"},
      {"key": "sandbox_test", "label": "Песочница/тест", "score_modifier": -5, "color": "warning"},
      {"key": "outdated", "label": "Устаревшее", "score_modifier": -20, "color": "muted"}
    ],
    "default_sources": [
      {"type": "rss", "name": "Habr DevOps", "url": "https://habr.com/ru/hub/devops/rss/"},
      {"type": "rss", "name": "DevOps.com", "url": "https://devops.com/feed/"},
      {"type": "rss", "name": "The New Stack", "url": "https://thenewstack.io/feed/"},
      {"type": "rss", "name": "CNCF Blog", "url": "https://www.cncf.io/feed/"},
      {"type": "rss", "name": "Kubernetes Blog", "url": "https://kubernetes.io/feed.xml"},
      {"type": "rss", "name": "Linux.org.ru", "url": "https://www.linux.org.ru/rss.jsp"}
    ]
  }'::jsonb,
  6
) ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "icon" = EXCLUDED."icon",
  "color" = EXCLUDED."color",
  "default_topic" = EXCLUDED."default_topic",
  "default_audience" = EXCLUDED."default_audience",
  "defaults_json" = EXCLUDED."defaults_json",
  "position" = EXCLUDED."position",
  "updated_at" = now();

-- 6. Update the scoring_criteria type check to include new AI sub-criteria
ALTER TABLE "scoring_criteria" DROP CONSTRAINT IF EXISTS "scoring_criteria_type_check";
ALTER TABLE "scoring_criteria" ADD CONSTRAINT "scoring_criteria_type_check"
  CHECK ("criterion_type" IN ('ai_relevance', 'keyword_match', 'freshness', 'source_trust', 'custom', 'relevance', 'novelty', 'hype', 'practical', 'local'));
