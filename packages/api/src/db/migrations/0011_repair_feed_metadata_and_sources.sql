-- Repair source URLs validated from the production network on 2026-07-13.
-- Reset health fields so the next collection records the new endpoint result.

UPDATE sources SET url = 'https://alistapart.com/main/feed/', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'A List Apart' AND url = 'https://alistapart.com/feed/';

UPDATE sources SET url = 'https://www.darkreading.com/rss.xml', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'Dark Reading' AND url = 'https://darkreading.com/rss_simple.asp';

UPDATE sources SET url = 'https://www.technologyreview.com/feed/', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'MIT Technology Review AI' AND url = 'https://www.technologyreview.com/feed/simple/the-download/';

UPDATE sources SET url = 'https://habr.com/ru/rss/companies/mws/articles/?fl=ru', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'MWS Cloud Blog' AND url = 'https://mws.cloud/services/blog/feed/';

UPDATE sources SET url = 'https://martech.org/feed/', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'Marketing Land' AND url = 'https://marketingland.com/feed/';

UPDATE sources SET url = 'https://www.securityweek.com/feed/', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'SecurityWeek' AND url = 'https://www.securityweek.com/rss.xml';

UPDATE sources SET url = 'https://www.who.int/rss-feeds/news-english.xml', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'WHO Newsroom';

UPDATE sources SET url = 'https://www.kaspersky.ru/blog/feed/', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'Kaspersky Daily RU';

UPDATE sources SET url = 'https://medicalxpress.com/rss-feed/', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'Medical Xpress' AND url = 'https://medicalxpress.com/rss-feed/medicine-news/';

UPDATE sources SET url = 'https://habr.com/ru/rss/companies/cloud_ru/articles/?fl=ru', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'SberCloud Blog';

UPDATE sources SET url = 'https://habr.com/ru/rss/companies/yandex_cloud_and_infra/articles/?fl=ru', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'Yandex Cloud Blog';

UPDATE sources SET url = 'https://www.constructiondive.com/feeds/news', is_active = TRUE,
  error_count = 0, last_error = NULL, fetch_status = 'never', updated_at = NOW()
WHERE name = 'Construction Dive';

UPDATE sources SET is_active = TRUE, error_count = 0, last_error = NULL,
  fetch_status = 'never', updated_at = NOW()
WHERE name = 'REG.ru Blog' AND url = 'https://reg.ru/blog/feed/';

-- These rows duplicate already-linked working sources. Keep one endpoint active.
UPDATE sources SET is_active = FALSE,
  last_error = 'Disabled: duplicate row with a working canonical feed',
  fetch_status = 'error', updated_at = NOW()
WHERE (name = 'The Hacker News' AND url = 'https://thehackernews.com/feed/')
   OR (name = 'VentureBeat AI' AND url = 'https://venturebeat.com/ai/feed/');

-- No working RSS/Atom replacement was found from the production network.
UPDATE sources SET is_active = FALSE,
  last_error = 'Disabled after production audit: no working RSS/Atom feed',
  fetch_status = 'error', updated_at = NOW()
WHERE name IN (
  'Dataline Blog',
  'Dribbble Blog',
  'Healthline News',
  'IT-Костыли',
  'Medical News Today',
  'MinIO Blog',
  'Open Observability',
  'Pro DNS',
  'Tencent Cloud Blog',
  'The Batch - Andrew Ng',
  'Т1 Cloud Blog'
);

UPDATE sources SET is_active = FALSE,
  last_error = 'Disabled: this endpoint is JSON, not RSS; a JSON adapter is required',
  fetch_status = 'error', updated_at = NOW()
WHERE name = 'NVD - National Vulnerability Database';

UPDATE sources SET is_active = FALSE,
  last_error = 'Disabled: regenerate the expired PubMed saved-search RSS URL',
  fetch_status = 'error', updated_at = NOW()
WHERE name = 'PubMed New';

UPDATE sources SET is_active = FALSE,
  last_error = 'Disabled after production audit: Telegram public preview is unavailable',
  fetch_status = 'error', updated_at = NOW()
WHERE name IN ('Kubernetes_ru', 'Linux & Co (Telegram)', 'OpenAI (Telegram)');

-- Remove records whose title or publication time cannot be trusted. Cascading
-- foreign keys remove their derived scores/fingerprints; a fresh fetch can then
-- recreate valid records from the repaired parser.
DELETE FROM articles a
USING sources s
WHERE a.source_id = s.id
  AND s.name IN ('Timeweb Cloud Blog', 'The Lancet')
  AND a.published_at IS NULL;

DELETE FROM articles a
USING sources s
WHERE a.source_id = s.id
  AND s.name = 'OpenNET'
  AND (
    position(chr(65533) in a.title) > 0
    OR position(chr(65533) in coalesce(a.description, '')) > 0
    OR position(chr(65533) in coalesce(a.content, '')) > 0
  );
