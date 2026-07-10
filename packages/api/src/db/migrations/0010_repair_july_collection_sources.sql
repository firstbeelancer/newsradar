-- Migration 0010: repair broken sources enabled by migration 0009.
--
-- Every replacement URL below was validated as a live RSS/Atom feed on
-- 2026-07-10. Sources without a working first-party feed are disabled so a
-- collect-all run reports actionable failures instead of permanent noise.

UPDATE sources
SET
  url = 'https://prometheus.io/blog/feed.xml',
  error_count = 0,
  last_error = NULL,
  fetch_status = 'never',
  updated_at = NOW()
WHERE name = 'Prometheus Blog'
  AND url = 'https://prometheus.io/feed.xml';

UPDATE sources
SET
  url = 'https://habr.com/ru/rss/companies/ruvds/articles/?fl=ru',
  error_count = 0,
  last_error = NULL,
  fetch_status = 'never',
  updated_at = NOW()
WHERE name = 'RUVDS'
  AND url = 'https://ruvds.com/blog/feed/';

UPDATE sources
SET
  url = 'https://timeweb.cloud/feed.xml',
  error_count = 0,
  last_error = NULL,
  fetch_status = 'never',
  updated_at = NOW()
WHERE name = 'Timeweb Cloud Blog'
  AND url = 'https://timeweb.cloud/blog/feed/';

UPDATE sources
SET
  url = 'https://habr.com/ru/rss/companies/pt/articles/?fl=ru',
  error_count = 0,
  last_error = NULL,
  fetch_status = 'never',
  updated_at = NOW()
WHERE name = 'Positive Technologies — PT'
  AND url = 'https://www.ptsecurity.com/ru-ru/research/blog/feed/';

UPDATE sources
SET
  url = 'https://habr.com/ru/rss/companies/postgrespro/articles/?fl=ru',
  error_count = 0,
  last_error = NULL,
  fetch_status = 'never',
  updated_at = NOW()
WHERE name = 'Postgres Pro Blog'
  AND url = 'https://habr.com/ru/company/postgrespro/blog/rss/all/';

UPDATE sources
SET
  url = 'https://www.infoq.cn/feed',
  error_count = 0,
  last_error = NULL,
  fetch_status = 'never',
  updated_at = NOW()
WHERE name = 'InfoQ CN'
  AND url = 'https://feed.infoq.cn/';

UPDATE sources
SET
  is_active = FALSE,
  last_error = 'Disabled: official feed is unavailable from production',
  fetch_status = 'error',
  updated_at = NOW()
WHERE name = 'Datadog Blog'
  AND url = 'https://www.datadoghq.com/blog/index.xml';

UPDATE sources
SET
  is_active = FALSE,
  last_error = 'Disabled: URL does not return an RSS/Atom feed',
  fetch_status = 'error',
  updated_at = NOW()
WHERE name IN (
  'Jiqizhixin (机器之心) — AI/Engineering',
  'Tencent Cloud Blog',
  'Aliyun Container Service',
  'Yandex Cloud Blog'
);

UPDATE sources
SET
  is_active = FALSE,
  last_error = 'Disabled: Telegram channel is private or unavailable',
  fetch_status = 'error',
  updated_at = NOW()
WHERE name IN (
  'RUVDS (Telegram)',
  'Linux & Co (Telegram)'
);
