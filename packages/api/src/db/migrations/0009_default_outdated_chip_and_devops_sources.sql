-- Migration 0009: default «Устаревшее» chip filter + devops sources
-- Idempotent: safe to re-run on production.

-- 1) Widen chip_filters CHECK constraint to allow age_days_* operators.
--    Without this, scoring.ts can't apply the default «Устаревшее» filter.
ALTER TABLE chip_filters DROP CONSTRAINT IF EXISTS chip_filters_operator_check;
ALTER TABLE chip_filters
  ADD CONSTRAINT chip_filters_operator_check
  CHECK (operator IN (
    'contains', 'not_contains', 'equals', 'starts_with', 'regex', 'in',
    'gt', 'lt', 'gte', 'lte',
    'age_days_gt', 'age_days_gte', 'age_days_lt', 'age_days_lte'
  ));

-- 2) Add default «Устаревшее» chip filter (-200, age > 3 days) to every agent
--    that doesn't already have one. Uses the same key as the front-end default,
--    so re-running is a no-op.
INSERT INTO chip_filters (agent_id, key, label, pattern, operator, score_modifier, color, icon, is_active, position, created_at, updated_at)
SELECT
  a.id,
  'outdated',
  'Устаревшее',
  '3',
  'age_days_gt',
  -200,
  '#dc2626',
  'clock',
  TRUE,
  COALESCE((SELECT MAX(position) FROM chip_filters cf WHERE cf.agent_id = a.id), -1) + 1,
  NOW(),
  NOW()
FROM agents a
WHERE NOT EXISTS (
  SELECT 1 FROM chip_filters cf
  WHERE cf.agent_id = a.id
    AND (cf.key = 'outdated' OR cf.label = 'Устаревшее')
);

-- 3) Seed default sources for the «devops» subject_area (Free DevOps & Инжиниринг).
--    Mirrors the pattern from migration 0003 for the original 5 subject areas.
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
    FOR ag_id IN SELECT id FROM agents WHERE workspace_id = ws_id AND subject_area = 'devops' LOOP
      -- International: open-source infra tooling
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Хабр — DevOps', 'rss', 'https://habr.com/ru/rss/hubs/devops/articles/?fl=ru', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Kubernetes Blog', 'rss', 'https://kubernetes.io/feed.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'CNCF Blog', 'rss', 'https://www.cncf.io/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Docker Blog', 'rss', 'https://www.docker.com/blog/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'HashiCorp Blog', 'rss', 'https://www.hashicorp.com/blog/feed.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Prometheus Blog', 'rss', 'https://prometheus.io/feed.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Grafana Blog', 'rss', 'https://grafana.com/blog/index.xml', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'GitHub Engineering', 'rss', 'https://github.blog/engineering/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'AWS Open Source Blog', 'rss', 'https://aws.amazon.com/blogs/opensource/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Cloudflare Blog', 'rss', 'https://blog.cloudflare.com/rss/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Reddit r/devops', 'rss', 'https://www.reddit.com/r/devops/.rss', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Reddit r/kubernetes', 'rss', 'https://www.reddit.com/r/kubernetes/.rss', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Lobsters', 'rss', 'https://lobste.rs/rss', NULL, false);

      -- Russian open-source / vendor news
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'OpenNET', 'rss', 'https://www.opennet.ru/opennews/opennews_all.rss', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Linux.org.ru — General', 'rss', 'https://www.linux.org.ru/section-rss.jsp?section=1', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Pro DNS', 'rss', 'https://www.prodns.ru/feed.xml', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Selectel Blog', 'rss', 'https://selectel.ru/blog/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'RUVDS', 'rss', 'https://ruvds.com/blog/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'MWS Cloud Blog', 'rss', 'https://mws.cloud/services/blog/feed/', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Yandex Cloud Blog', 'rss', 'https://yandex.cloud/ru/blog/rss', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'VK Cloud Blog', 'rss', 'https://vk.com/@vkcloud-rss', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'SberCloud Blog', 'rss', 'https://sbercloud.ru/ru/blog/feed', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Arenadata Blog', 'rss', 'https://arenadata.tech/feed/', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'КРОК — Блог', 'rss', 'https://www.croc.ru/blog/rss/', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Positive Technologies — PT', 'rss', 'https://www.ptsecurity.com/ru-ru/research/blog/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Postgres Pro Blog', 'rss', 'https://habr.com/ru/company/postgrespro/blog/rss/all/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Dataline Blog', 'rss', 'https://dataline.ru/blog/feed', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Т1 Cloud Blog', 'rss', 'https://t1.cloud/ru/blog/feed/', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Aéza Blog', 'rss', 'https://aéza.net/blog/feed/', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'FirstVDS Blog', 'rss', 'https://firstvds.ru/blog/feed', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Timeweb Cloud Blog', 'rss', 'https://timeweb.cloud/blog/feed/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'REG.ru Blog', 'rss', 'https://reg.ru/blog/feed/', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'AdminShit Blog', 'rss', 'https://adminshit.net/feed/', NULL, false);

      -- Chinese open-source (translated headlines via RSS aggregators / official blogs)
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'InfoQ CN', 'rss', 'https://feed.infoq.cn/', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'OSCHINA — китайский open-source', 'rss', 'https://www.oschina.net/news/rss', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, '36Kr DevOps Channel', 'rss', 'https://36kr.com/feed', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Jiqizhixin (机器之心) — AI/Engineering', 'rss', 'https://www.jiqizhixin.com/rss', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'CSDN Blog', 'rss', 'https://blog.csdn.net/rss', NULL, false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Aliyun Container Service', 'rss', 'https://yq.aliyun.com/containers/feed', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Tencent Cloud Blog', 'rss', 'https://cloud.tencent.com/developer/feed', NULL, true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Huawei Cloud Blog', 'rss', 'https://bbs.huaweicloud.com/blogs/feed', NULL, false);

      -- Telegram-каналы
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'DevOps by REBRAIN', 'telegram', 'https://t.me/devopsbrain', 'devopsbrain', true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'DevOps Deflope', 'telegram', 'https://t.me/devops_deflope', 'devops_deflope', true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Kubernetes_ru', 'telegram', 'https://t.me/kubernetes_ru', 'kubernetes_ru', true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'OpenSourceNotes', 'telegram', 'https://t.me/opensource_notes', 'opensource_notes', false);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Linux & Co (Telegram)', 'telegram', 'https://t.me/linux_ru', 'linux_ru', true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'Selectel (Telegram)', 'telegram', 'https://t.me/selectel', 'selectel', true);
      PERFORM _nr_insert_source_and_link(ws_id, ag_id, 'RUVDS (Telegram)', 'telegram', 'https://t.me/ruvds', 'ruvds', true);
    END LOOP;
  END LOOP;
END $$;

DROP FUNCTION _nr_insert_source_and_link(UUID, UUID, VARCHAR, VARCHAR, TEXT, VARCHAR, BOOLEAN);
