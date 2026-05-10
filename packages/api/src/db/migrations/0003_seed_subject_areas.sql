-- ─────────────────────────────────────────────────────────────
-- Seed data: subject_areas
-- 5 предустановленных предметных областей из ТСЗ (v3.2)
-- Date: 2026-05-09
-- ─────────────────────────────────────────────────────────────

-- Очищаем перед вставкой (для idempotency)
DELETE FROM subject_areas;

INSERT INTO "subject_areas" ("id", "label", "icon", "color", "default_topic", "default_audience", "defaults_json", "position") VALUES
  ('infosec', 'Информационная безопасность', 'shield', '#ef4444', 'Информационная безопасность', 'IT-специалисты, CISO, DevOps-инженеры', '{"scoring_weights":{"ai_relevance":0.4,"keyword_match":0.3,"freshness":0.2,"source_trust":0.1},"chip_filters":["critical_vuln","zero_day","apt","ransomware"]}', 0),
  ('ai',      'Искусственный интеллект',      'brain', '#8b5cf6', 'Искусственный интеллект',      'Разработчики ML, Data Scientists, CTO',           '{"scoring_weights":{"ai_relevance":0.5,"keyword_match":0.2,"freshness":0.2,"source_trust":0.1},"chip_filters":["llm","foundation_model","rag","fine_tuning"]}', 1),
  ('marketing', 'Маркетинг',                  'trending-up', '#10b981', 'Маркетинг и аналитика',        'Маркетологи, SMM-специалисты, Growth-хакеры',    '{"scoring_weights":{"ai_relevance":0.3,"keyword_match":0.3,"freshness":0.25,"source_trust":0.15},"chip_filters":["seo","ppc","content_marketing","influencer"]}', 2),
  ('medical',  'Медицина',                    'heart-pulse', '#3b82f6', 'Медицина и здоровье',          'Врачи, медицинские исследователи, пациенты',      '{"scoring_weights":{"ai_relevance":0.35,"keyword_match":0.25,"freshness":0.25,"source_trust":0.15},"chip_filters":["clinical_trials","telemedicine","ehealth","pharma"]}', 3),
  ('design',   'Графический дизайн',          'palette', '#f97316', 'Графический дизайн',           'Дизайнеры, UI/UX-специалисты, креативные директора', '{"scoring_weights":{"ai_relevance":0.25,"keyword_match":0.3,"freshness":0.25,"source_trust":0.2},"chip_filters":["ui_ux","graphic_design","motion","branding"]}', 4);