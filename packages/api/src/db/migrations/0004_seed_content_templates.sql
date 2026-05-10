-- ─────────────────────────────────────────────────────────────
-- Seed data: content_templates (стоковые промты для агентов)
-- Каждый шаблон привязан к workspace (берём первый workspace из БД)
-- Date: 2026-05-09
-- ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  ws_id uuid;
BEGIN
  -- Берём первый доступный workspace
  SELECT id INTO ws_id FROM "workspaces" LIMIT 1;

  IF ws_id IS NULL THEN
    RAISE NOTICE 'Нет workspace — сиды не применены. Создайте workspace через API и повторите seed.';
    RETURN;
  END IF;

  -- Краткое резюме статьи
  INSERT INTO "content_templates" ("id", "name", "type", "system_prompt", "user_prompt", "variables", "workspace_id", "is_default", "position") VALUES
    (gen_random_uuid(), 'Краткое резюме', 'short',
     'Ты — экспертный редактор новостей. Суммируй статью в краткое, ёмкое резюме на русском языке. Сохраняй ключевые факты, имена и цифры. Не добавляй собственных оценок.',
     'На основе следующей статьи составь краткое резюме (не более 150 слов):

{{content}}',
     '[]', ws_id, false, 0);

  -- Подробный анализ
  INSERT INTO "content_templates" ("id", "name", "type", "system_prompt", "user_prompt", "variables", "workspace_id", "is_default", "position") VALUES
    (gen_random_uuid(), 'Подробный анализ', 'detailed',
     'Ты — аналитик новостей. Проведи глубокий анализ статьи: выдели ключевые тезисы, оцени достоверность источника, найди связи с другими событиями в сфере. Отвечай на русском языке.',
     'Проанализируй следующую статью. Выдели:
1. Ключевые тезисы
2. Достоверность и возможные предвзятости
3. Связи с другими событиями в этой сфере
4. Возможное влияние на отрасль

Статья:
{{content}}',
     '[]', ws_id, false, 1);

  -- Дайджест за день
  INSERT INTO "content_templates" ("id", "name", "type", "system_prompt", "user_prompt", "variables", "workspace_id", "is_default", "position") VALUES
    (gen_random_uuid(), 'Дайджест дня', 'digest',
     'Ты — главный редактор новостного агрегатора. Составь структурированный дайджест из нескольких статей. Группируй по темам, выдели главную новость дня, добавь краткий комментарий аналитика. Работай на русском языке.',
     'Составь дайджест из следующих статей. Структура:
1. Главная новость дня (самая важная)
2. Тематические блоки (не более 5 категорий)
3. Краткий аналитический комментарий

Статьи:
{% for article in articles %}
===
Заголовок: {{article.title}}
Описание: {{article.description}}
Контент: {{article.content}}
{% endfor %}',
     '[{"name": "articles", "description": "Список собранных статей"}]', ws_id, true, 2);

  -- Мониторинг уязвимостей (для кибербезопасности)
  INSERT INTO "content_templates" ("id", "name", "type", "system_prompt", "user_prompt", "variables", "workspace_id", "is_default", "position") VALUES
    (gen_random_uuid(), 'Отчёт по уязвимостям', 'detailed',
     'Ты — аналитик по кибербезопасности. Формируй структурированный отчёт об обнаруженных уязвимостях. Оцени критичность по CVSS, рекомендуй приоритеты патчинга.',
     'Сформируй отчёт по следующим уязвимостям:

{% for article in articles %}
===
Уязвимость: {{article.title}}
Описание: {{article.description}}
{{article.content}}
{% endfor %}

Для каждой уязвимости укажи:
1. Уровень критичности (Critical/High/Medium/Low)
2. Рекомендуемые действия по устранению
3. Сроки патчинга',
     '[{"name": "articles", "description": "Список статей об уязвимостях"}]', ws_id, false, 3);

  -- AI-резюме технологических новостей
  INSERT INTO "content_templates" ("id", "name", "type", "system_prompt", "user_prompt", "variables", "workspace_id", "is_default", "position") VALUES
    (gen_random_uuid(), 'AI-подборка', 'short',
     'Ты — AI-ассистент, который отбирает самые важные технологические новости дня. Формулируй кратко и ёмко, добавляй ссылки на источники.',
     'Отбери топ-5 самых важных новостей из следующих материалов и сформируй краткую подборку:

{% for article in articles %}
- [{{article.title}}]({{article.link}})
{{article.description}}
{% endfor %}',
     '[{"name": "articles", "description": "Список статей за период"}]', ws_id, false, 4);

  RAISE NOTICE 'Seed: 5 шаблонов промтов создано для workspace %', ws_id;
END $$;