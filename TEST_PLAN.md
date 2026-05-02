# План тестирования NewsRadar v3.2

> Документ описывает структуру, стратегию и содержание тестов для ТЗ `newsradar_tz_v_3_2.md`.
> Основание: раздел 36 ТЗ — «Структура и реализация», 35 критериев приёмки (раздел 42).

---

## 1. Архитектура тестов

Тесты разбиты по четырём слоям проекта (раздел 34 ТЗ):

```
packages/
├── api/__tests__/       # API-тесты: модули, middleware, lib
├── worker/__tests__/    # Тесты BullMQ-воркера
├── web/__tests__/       # Тесты React-фронтенда
e2e/                     # Сквозные E2E-сценарии
```

**Технологический стек:**
- **Vitest** — фреймворк (globals, vi.mock)
- **v8** — coverage provider
- **jsdom** — окружение для web-тестов
- **node** — окружение для api/worker/e2e

**Принцип мокирования:** все внешние зависимости (pg, ioredis, bullmq, openai, rss-parser, axios, bcrypt, jwt, passport, @aws-sdk/*) замоканы глобально в `setup.ts` каждого пакета. Это изолирует unit-тесты от инфраструктуры.

---

## 2. Структура тестовых файлов

### 2.1. `packages/api/__tests__/setup.ts`
Глобальные моки для API-тестов:
- `pg` (Pool) — мок PostgreSQL
- `ioredis` — мок Redis
- `bullmq` (Queue, Worker, QueueEvents)
- `openai` — мок AI-провайдера
- `pino` — мок логгера
- `@aws-sdk/client-s3` — мок S3
- `rss-parser` — мок RSS-парсера
- `axios` — мок HTTP-клиента
- `cheerio` — мок HTML-парсера
- `bcrypt` — мок хеширования паролей
- `jsonwebtoken` — мок JWT
- `passport` — мок аутентификации

Предоставляет хелперы: `createMockRequest()`, `createMockResponse()`, `createMockNext()`, тестовые константы (`TEST_USER_ID`, `TEST_WORKSPACE_ID`, `TEST_AGENT_ID`).

---

### 2.2. Модульные тесты API (`packages/api/__tests__/modules/`)

#### 2.2.1. `auth.test.ts` — Аутентификация (раздел 14, 39 ТЗ)
**12 групп тестов:**

| Группа | Что проверяется |
|---|---|
| `POST /auth/register` | Обязательность email, валидация формата, минимальная длина пароля (8 символов), создание workspace при регистрации, возврат access+refresh токенов, bcrypt-хеширование, 409 на дубликат email, нелогирование пароля |
| `POST /auth/login` | 401 при неверном пароле, 404 при несуществующем email, выдача токенов, TTL access = 15 мин, refresh = httpOnly cookie, TTL refresh = 30 дней |
| `POST /auth/refresh` | Выдача новой пары токенов, ротация (инвалидация старого refresh), 401 на просроченный/отсутствующий refresh |
| `POST /auth/logout` | Инвалидация refresh, очистка cookie |
| `OAuth` | Google/Yandex flow (инициирование + callback), создание workspace при первом входе |
| `Rate limiting` | POST /auth/login и /auth/register: ≤ 100 запросов/мин |

#### 2.2.2. `workspace.test.ts` — Workspace (раздел 15 ТЗ)
**3 группы тестов:**

| Группа | Что проверяется |
|---|---|
| Модель данных | `workspaces.user_id` — UNIQUE (один пользователь = один workspace), автосоздание при регистрации, `plan` по умолчанию = `free`, запрет таблиц `workspace_members`/`roles`/`permissions`, AI-провайдеры глобально на workspace по процессам |
| Downgrade Pro → Free | Контент недоступен, но не удалён; агенты сверх 2 неактивны; избранное сверх 100 — read-only; восстановление при возобновлении Pro |

#### 2.2.3. `agents.test.ts` — Агенты (раздел 6, 36.2 ТЗ)
**13 групп тестов:**

| Группа | Что проверяется |
|---|---|
| `GET /api/v1/agents` | Список агентов; Free: ≤ 2 агента; Pro: без ограничений; 403 при превышении лимита |
| `POST /api/v1/agents` | Поля: название, предметная область, аудитория, персона; область из 5 предустановленных; Агент НЕ хранит AI-модель (обращается к процессу); источники привязаны к агенту; медицинский агент — обязательный дисклеймер |
| `GET /api/v1/agents/:id` | Полная конфигурация; 403 на чужих агентов; нет agent.members |
| `PUT /api/v1/agents/:id` | Обновление: name, persona, audience, prompts, scoring criteria, chip filters, generation templates, asset pack/emoji |
| `DELETE /api/v1/agents/:id` | Каскадное удаление источников и новостей |
| `POST /agents/:id/collect` | Запуск сбора, возврат `operation_log_id`, проверка лимита `collection_runs` |
| `POST /agents/:id/rescore` | Перескоринг всех новостей = 1 scoring run |
| `GET /agents/:id/feed` | Cursor-based пагинация, limit=20, `next_cursor`, фильтр по agent_id |
| Dashboard agent cards | Только название + счётчик новостей; НЕ показывать high score/статусы/ошибки |
| Приоритет наполнения | Порядок: ИБ → AI → Маркетинг → Дизайн → Медицина |

#### 2.2.4. `sources.test.ts` — Источники (раздел 7, 8, 36.3 ТЗ)
**10 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Типы источников | Только `rss` и `telegram_channel`; запрет `web_scrape`/`sitemap`/`custom_api` |
| Добавление RSS | Поля type+url+label; валидация URL (http/https); запрет localhost/private IP/metadata; cron-расписание |
| Добавление Telegram | type=`telegram_channel`; трансформация t.me → t.me/s; парсинг публичной HTML; явный User-Agent; запрет Bot API |
| Cron-расписание | Пресеты (каждый час / 6 часов / сутки); пользовательский cron; валидация 5 полей |
| Health источника | Статусы: active/warning/paused/failed; пороги ошибок (2→warning, 5→paused); ручное возобновление; поля error_count/last_error/last_success_at/status |
| Ручной сбор | Запуск сбора одного источника, возврат job_id, логирование ошибок |
| Тест источника | Проверка доступности без сохранения; поля status/articles_found/response_time_ms |
| Статистика | total_fetches, success_rate, last_fetch, avg_articles |
| Telegram-автотест | Автотест раз в сутки; >5 ошибок → alert + paused; fallback — ручной перезапуск |
| Fetch-безопасность | Таймаут, лимит размера, лимит редиректов (5), HTML-санитизация, запрет скриптов |

#### 2.2.5. `articles.test.ts` — Статьи (раздел 9, 10, 25, 27, 36.4 ТЗ)
**9 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Пайплайн | 12 шагов в правильном порядке: Source → Fetch → Raw Dedup → Translate → Semantic Dedup → Ingest → Score → Chip Filters → Feed → Generate/Digest/DeepSearch → Edit → Copy |
| Raw Dedup | Проверка URL hash, canonical URL, source GUID, title hash; дубли не идут на перевод |
| Semantic Dedup | Нормализованный title, `pg_trgm` similarity, окно 3 дня, проверка по другим источникам агента |
| Перевод | Перевод title и description на русский; сохранение оригинала (`original_title`, `original_description`, `original_lang`); индикатор языка `[EN]`/`[ZH]`/`[KO]`; клик → показать оригинал; русский источник → `needs_translation=false` |
| Изображения | Не скачиваются в S3; не отображаются в карточке; сохраняются как `image_url` опционально |
| TTL | Обычные статьи — 3 дня; избранные не удаляются; `article_fingerprints` — 3 дня |
| Детали статьи | Полная информация, `score_detail`, язык оригинала |
| Избранное | Лимиты: Free=100, Pro=1000; ошибка при превышении; `ttl_mode` (30d / forever) |
| Удаление из избранного | Удаление связи, не самой статьи |

#### 2.2.6. `ai-providers.test.ts` — AI-провайдеры (раздел 11, 36.7 ТЗ)
**8 групп тестов:**

| Группа | Что проверяется |
|---|---|
| AI-процессы | 6 процессов: search, translation, ingest_analysis, scoring, generation, deepsearch; назначение глобально на workspace; предупреждение при занятом процессе |
| Platform provider | OpenRouter по умолчанию; модель `tencent/hy3-preview:free` через env; замена без изменения кода; `is_platform=true` |
| BYOK | Поддержка OpenRouter BYOK, OpenAI-compatible endpoint, Gemini-compatible (адаптер); произвольный base_url/endpoint/model_id |
| Шифрование | AES-256-GCM, ключ из `ENCRYPTION_KEY` (env); маска в UI `sk-****-****`; не логируется; не экспортируется; не попадает в `operation_logs`; ротация через `reencrypt-keys.ts` |
| Создание BYOK | Поля: name, provider_type, base_url, model_id; шифрование api_key; параметры max_tokens/temperature/timeout_ms |
| Дублирование | Копирование provider_type/base_url/endpoint/api_key/model_settings; очистка assigned_to у копии |
| Назначение | Назначение на процессы; один процесс = один провайдер (замена) |
| Удаление | Нельзя удалить platform provider; при удалении BYOK — возврат процессов к platform |

#### 2.2.7. `scoring.test.ts` — Скоринг (раздел 16, 17, 18, 36.8 ТЗ)
**6 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Четырёхуровневая модель | raw_score (AI 1..10) → normalized (Z-score + Min-Max 0..1) → weighted (веса) → overall (чип-модификаторы); 7 критериев; 5 знаков после запятой |
| Эталонный паттерн-идеал | Для каждой из 5 предметных областей; μ и σ на выборке; формула Z-score; Min-Max Scaling с окном 3σ |
| Веса критериев | 7 критериев с весами (сумма = 1.0); пользовательская настройка; ошибка при сумме ≠ 1.0 |
| Чип-фильтры | 5 чипов (exclusive +0.15, actionable +0.10, trending +0.10, controversy +0.10, verified +0.10); аддитивные модификаторы; threshold для каждого; чипсет зависит от предметной области; пользовательская настройка |
| score_detail | raw_score, normalized, weighted, overall, chips_triggered, chips_available; поля score_diff и reason |
| Перескоринг | Автоматический при изменении весов/чипов; rescore всех статей = 1 scoring run |

#### 2.2.8. `generation.test.ts` — Генерация (раздел 19, 20, 21, 36.9 ТЗ)
**8 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Типы генерации | Digest (2-частная структура), Collection (7 частей), DeepSearch (6 частей) |
| Шаблонизатор | Переменные `{{variable}}`; неизвестная → пустая строка; экранирование `\{{not_var}}` |
| Asset pack / Emoji | Типы: emoji, icon, color, font_size, layout; emoji mapping (urgency_high→🔴, verified→✅, и т.д.) |
| SSE-стриминг | text/event-stream; delta-токены; [DONE]; AbortController |
| История | Пагинация; фильтр по агенту и типу (digest/collection/deepsearch) |
| Копирование | Кнопка «Скопировать»; Clipboard API (navigator.clipboard.writeText); HTTPS обязателен |
| Лимиты | Free: 24 генерации/мес; Pro: безлимит; превышение → 429 |
| Prompt templates | agent_config.gpt_prompts; пользовательское редактирование; значения по умолчанию из конфига |

#### 2.2.9. `subscription.test.ts` — Подписка (раздел 12, 13, 28, 36.11 ТЗ)
**8 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Telegram Stars | 3 тарифа: 1w=100⭐, 1m=400⭐, 1y=4000⭐; Payments API 8.0+; createInvoiceLink(XTR); webhook pre_checkout_query / successful_payment |
| Возврат звёзд | Refund при неактивированном Pro; pending > 30 мин → возврат; ручной refund |
| Авто-докупание | Deep link на покупку звёзд; проверка статуса каждые 30 мин |
| Статус подписки | plan, expires_at, auto_renew, features, usage, limits |
| Отмена auto-renew | Выключение auto_renew; Pro до конца периода; затем переход на free |
| Лимиты | Таблица: agents (2/∞), sources_per_agent (4/∞), collection_runs (24/∞), scoring_analysis_runs (24/∞), generation_requests (24/∞), deepsearch_requests (3/∞), favorites (100/1000), article_ttl (3/3), logs_retention (3/3), iboards (0/∞) |
| Счётчики | Ежемесячный сброс (UTC 00:00 первого числа) |
| Downgrade | Контент не удалён; агенты неактивны; избранное read-only; восстановление при Pro |
| Telegram Mini App | WebView-открытие; аутентификация через initData (HMAC-верификация); привязка Telegram ID; openInvoice; invoice_closed; enableClosingConfirmation; theme toggle; MainButton «Сгенерировать» |

#### 2.2.10. `logs.test.ts` — Логирование (раздел 22, 36.12, 39.3 ТЗ)
**4 группы тестов:**

| Группа | Что проверяется |
|---|---|
| agent_logs | Фильтр по уровню (info/warning/error/debug); пагинация; фильтр по источнику и датам; TTL 3 дня |
| system_logs | Системные события workspace; админ видит всё; пользователь — только свои |
| operation_logs | Типы: collection, scoring, generation, deepsearch, translation, dedup; поля: log_id, timestamp, type, status, duration_ms, article_count, error_message; экспорт в CSV |
| Sanitizer | Список чувствительных ключей (api_key, password, token, refresh_token, secret) → `***REDACTED***`; санитизация query params; санитизация JSON body; санитизация headers (Bearer); case-insensitive |

#### 2.2.11. `security.test.ts` — Безопасность (раздел 8, 38, 39, 41 ТЗ)
**7 групп тестов:**

| Группа | Что проверяется |
|---|---|
| SQL Injection | 5 payloads (`' OR 1=1`, `'; DROP TABLE`, `UNION SELECT`, `UPDATE SET`, `LIMIT`); параметризованные запросы; поля по имени, не позиции |
| XSS Protection | 4 payloads (`<script>`, `<img onerror>`, `<svg onload>`, `javascript:`); санитизация HTML из RSS; React-экранирование JSX; запрет `dangerouslySetInnerHTML`; санитизация markdown-to-jsx |
| CSRF | SameSite=Strict на refresh cookie; HttpOnly; Secure в production |
| SSRF | Блокировка: localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254 (metadata), ::1 (IPv6 loopback); DNS rebinding защита |
| API Key Encryption | AES-256-GCM; уникальный IV (nonce) на каждый ключ; nonce хранится рядом с ciphertext (`iv::ciphertext::authTag`) |
| Authorization | Проверка workspace_id в каждом запросе; чужой агент → 403 |
| Brute Force | Rate limiting 100/мин на /auth/login; exponential backoff при последовательных ошибках |

#### 2.2.12. `iboard.test.ts` — iBoard (раздел 23, 36.13 ТЗ)
**5 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Доступность | Только Pro; на Free скрыт; GET /api/v1/iboard/summary |
| Виджеты | 6 типов: article_volume_chart, score_distribution, source_activity, trend_timeline, keyword_cloud, top_categories |
| Фильтрация | По агенту; по периоду (day/week/month) |
| Обновление | Данные обновляются при сборе; источник — только статьи из ленты |
| Ограничения | Read-only; нет кастомных виджетов; нет редактирования; нет экспорта |

#### 2.2.13. `database.test.ts` — Схема БД (раздел 23.1, 24, 25 ТЗ)
**6 групп тестов:**

| Группа | Что проверяется |
|---|---|
| `users` | 9 колонок; email UNIQUE; telegram_id UNIQUE; google_id/yandex_id для OAuth |
| `workspaces` | user_id UNIQUE; plan DEFAULT free; НЕТ workspace_members |
| `agents` | Обязательные поля (9+); НЕТ provider_id/model; config JSONB (scoring_weights, chip_filters, gpt_prompts) |
| `sources` | type: rss \| telegram_channel; url NOT NULL; fetch_schedule cron; health JSONB |
| `articles` | original_title / translated_title раздельно; original_description / translated_description; detected_lang/needs_translation; score_detail JSONB; ordered_at для cursor-пагинации |
| `article_fingerprints` | fingerprint_hash UNIQUE; типы fingerprint: url_hash/guid/title_hash/semantic; expires_at для TTL |
| Индексы | (agent_id, ordered_at DESC, id DESC) — лента; (fingerprint_hash, fingerprint_type) UNIQUE; (updated_at) — очистка; pg_trgm на translated_title |
| Триггеры | AUTO updated_at на users/workspaces/agents/sources; НЕТ на articles (ordered_at фиксирован) |
| Foreign Keys | workspaces.user_id → users.id CASCADE; agents.workspace_id → workspaces.id CASCADE; sources.agent_id → agents.id CASCADE; articles.agent_id → agents.id CASCADE |

---

### 2.3. Middleware-тесты (`packages/api/__tests__/middleware/middleware.test.ts`)

**7 групп тестов:**

| Группа | Что проверяется |
|---|---|
| JWT Auth | Извлечение из `Authorization: Bearer <token>`; 401 без токена; 401 при просрочке (15 мин)/неверной подписи; добавление user + workspace_id в req |
| Rate Limiting | GET /api/v1/*: 300/мин; POST /auth/*: 100/мин; 429 при превышении; заголовки X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After; скользящее окно 1 мин |
| CORS | Разрешённые origins; preflight OPTIONS; разрешённые заголовки (Authorization, Content-Type); методы (GET/POST/PUT/DELETE/OPTIONS) |
| Error Handler | ZodError → 400; NotFoundError → 404; UnauthorizedError → 401; ForbiddenError → 403; ConflictError → 409; LimitExceededError → 429; неизвестная → 500; в dev — stack trace, в production — `{"error":"Internal Server Error"}` |
| Request Logging | method, url, status, duration_ms; Sanitizer перед записью |
| Pagination | POST /api/v1/*/query с cursor в теле; ответ: data + next_cursor + total?; cursor = base64({ ordered_at, id }); limit=20 default, max=100; next_cursor=null в конце |
| Zod Validation | Валидация body / query / path params; 400 + errors[] (path, message, code) при невалидном запросе |

---

### 2.4. Lib-тесты (`packages/api/__tests__/lib/lib.test.ts`)

**5 групп тестов:**

| Модуль | Что проверяется |
|---|---|
| `encryption.ts` | encrypt → `iv:ciphertext:authTag`; decrypt(encrypt(x)) === x; уникальный IV на каждый вызов; ошибка при неверном authTag; ошибка при неверном ключе; ключ 32 байта (AES-256); IV 12 байт; authTag 16 байт |
| `pagination.ts` | encode_cursor → base64; decode_cursor → { ordered_at, id }; cursor=null → первая страница; SQL Keyset Pagination: `WHERE (ordered_at, id) < ($1, $2) ORDER BY ordered_at DESC, id DESC`; limit 20/100; next_cursor из последней записи; null при исчерпании |
| `sanitizer.ts` | sanitize_key(password/api_key/token/...) → `***REDACTED***`; sanitize_query → замена значений; sanitize_json → рекурсивная замена; sanitize_headers → замена Bearer; case-insensitive; вложенный JSON внутри строк |
| `url-validator.ts` | Разрешены http/https; запрещены file/ftp/javascript; is_localhost (localhost, 127.0.0.1, [::1]); is_private_ip (10.x, 172.16.x, 192.168.x); is_metadata_ip (169.254.169.254); DNS rebinding: resolve → validate IP → connect |
| `cron-validator.ts` | 5 полей — валидно; 6 полей — невалидно; некорректные значения полей → ошибка |

---

### 2.5. Worker-тесты (`packages/worker/__tests__/worker.test.ts`)

**7 групп тестов:**

| Группа | Что проверяется |
|---|---|
| `fetch` | Очередь `source:fetch`; RSS через rss-parser; Telegram через парсинг t.me/s; User-Agent Newsradar/3.2; timeout 30с; лимит ответа 10 MB; макс. редиректов 5; логирование ошибок; обновление health (error_count, last_error, status); сброс error_count при успехе |
| `translate` | Очередь `article:translate`; AI-провайдер процесса translation; сохранение оригинала; определение языка; русский → пропуск |
| `dedup` | Raw Dedup (URL hash + GUID + title hash) до перевода; Semantic Dedup (pg_trgm) после перевода; TTL fingerprints = 3 дня |
| `scoring` | Очередь `article:score`; батчинг: rescore всего агента = 1 job; сохранение score_detail |
| `cleanup` | Cron 03:00 UTC; удаление fingerprints > 3 дней; удаление agent_logs > 3 дней; НЕ удалять избранные; НЕ удалять operation_logs |
| `usage_reset` | Cron 1-го числа 00:00 UTC; сброс collection_runs_used, scoring_analysis_runs_used, generation_requests_used, deepsearch_requests_used |
| `telegram_webhook` | pre_checkout_query < 10 сек; successful_payment → активация Pro |

---

### 2.6. Web-тесты (`packages/web/__tests__/web.test.ts`)

**10 групп тестов:**

| Группа | Что проверяется |
|---|---|
| Dashboard | Карточка агента: только name + article_count; НЕ high score / статусы / ошибки; переход к ленте по клику |
| AgentConfig | Форма: name, subject_area, target_audience, persona_tone; select из 5 областей; scoring_weights, chip_filters, gpt_prompts, asset pack/emoji, fetch_schedule |
| SourceManager | Форма RSS (url+label); форма Telegram (@username → t.me); health-индикаторы (🟢/🟡/⏸️); кнопки «Тест»/«Собрать»; Pause/Resume |
| NewsFeed | Список карточек; Infinite scroll (IntersectionObserver); cursor-based пагинация; skeleton/spinner; «Нет новостей» |
| NewsCard | Поля: title, score, source_label, time_ago, language_indicator; НЕТ изображений; индикатор [EN]/[ZH]/[KO]; клик → оригинал; ⭐ избранное; score-градиент (красный↔зелёный); переход на детали |
| GenerationResult | Стриминг токенов; Digest/Collection/DeepSearch структуры; «Скопировать»/«Скачать»; информационная плашка |
| iBoard | Pro-only; 6 виджетов-графиков; фильтр по агенту и периоду; read-only |
| Subscription UI | Тарифы 1w(100⭐)/1m(400⭐)/1y(4000⭐); кнопка «Оплатить ⭐»; прогресс-бар лимитов; счётчики использовано/доступно |
| Telegram Mini App | Theme toggle dark/light; MainButton «Сгенерировать»; enableClosingConfirmation; BackButton; адаптивный WebView-лейаут |
| Accessibility / UI Kit | aria-labels; цветовые токены (9); система отступов (6 уровней); шрифт «Mulish» локально; тёмный режим чтения с зелёным |

**Моки в setup.ts:** `window.Telegram.WebApp`, `IntersectionObserver`, `ResizeObserver`, `navigator.clipboard`, `window.matchMedia`.

---

### 2.7. E2E-тесты (`e2e/e2e.test.ts`)

**10 сквозных сценариев:**

| Сценарий | Шаги |
|---|---|
| 1. Регистрация и onboarding | email+password → workspace → первый агент (ИБ) → RSS-источник → ручной сбор → статьи в ленте → скоринг |
| 2. Пайплайн новости | Fetch → Raw Dedup → Translate → Semantic Dedup → Ingest → Score → Feed (7 шагов) |
| 3. Генерация контента | Digest → SSE → Collection (7 частей) → DeepSearch (6 частей) → копирование |
| 4. Оплата Telegram Stars | Тарифы → createInvoiceLink → successful_payment → Pro → iBoard доступен |
| 5. Downgrade Pro → Free | Окончание → агенты неактивны → избранное read-only → iBoard скрыт → восстановление |
| 6. Telegram Mini App | WebView → initData аутентификация → MainButton → enableClosingConfirmation → theme toggle |
| 7. AI-провайдеры | BYOK OpenRouter → назначение на scoring → дублирование → удаление → возврат к platform |
| 8. Очистка данных | Статьи > 3д удалены; избранные сохранены; fingerprints > 3д удалены; логи > 3д удалены |
| 9. Мульти-источники | RSS + Telegram → общая лента → health каждого → paused при ошибках → ручное возобновление |
| 10. Обработка ошибок | Недоступный RSS, AI-провайдер, лимиты (429), лимит агентов (403), токен (401), чужой workspace (403) |

**+ 35 критериев приёмки** (раздел 42 ТЗ) — полный перечень с маппингом на тестовые группы.

---

## 3. Запуск тестов

```bash
# Все тесты (workspace-конфиг подхватывает все пакеты)
npx vitest

# Конкретный модуль
npx vitest packages/api/__tests__/modules/auth.test.ts

# Coverage
npx vitest --coverage

# Только E2E
npx vitest -c e2e/vitest.config.ts

# Worker
npx vitest -c packages/worker/__tests__/vitest.config.ts

# Web
npx vitest -c packages/web/__tests__/vitest.config.ts
```

---

## 4. Покрытие по разделам ТЗ

| Раздел ТЗ | Название | Тестовый файл |
|---|---|---|
| 4 | Главный дашборд (Dashboard) | agents.test.ts, web.test.ts |
| 5 | Лента новостей (NewsFeed) | articles.test.ts, web.test.ts |
| 6 | Агенты (Agents) | agents.test.ts, web.test.ts |
| 7 | Источники (Sources) | sources.test.ts, web.test.ts |
| 8 | Техническая защита источников | sources.test.ts, security.test.ts, worker.test.ts |
| 9 | Дедупликация | articles.test.ts, worker.test.ts |
| 10 | Перевод | articles.test.ts, worker.test.ts |
| 11 | AI-провайдеры | ai-providers.test.ts, lib.test.ts |
| 12 | Планы и лимиты | subscription.test.ts, agents.test.ts, scoring.test.ts, articles.test.ts |
| 13 | Telegram Stars | subscription.test.ts, worker.test.ts |
| 14 | Регистрация и аутентификация | auth.test.ts |
| 15 | Workspace | workspace.test.ts |
| 16 | Скоринг: модель | scoring.test.ts |
| 17 | Скоринг: веса критериев | scoring.test.ts |
| 18 | Скоринг: чип-фильтры | scoring.test.ts |
| 19 | Генерация: типы | generation.test.ts |
| 20 | Генерация: UI | generation.test.ts, web.test.ts |
| 21 | Генерация: промпты и шаблоны | generation.test.ts |
| 22 | Логи операций | logs.test.ts |
| 23 | iBoard | iboard.test.ts, web.test.ts |
| 24 | Модель данных | database.test.ts |
| 25 | TTL и очистка | database.test.ts, worker.test.ts |
| 27 | Изображения | articles.test.ts, web.test.ts |
| 28 | Telegram Mini App | subscription.test.ts, web.test.ts |
| 29 | API: спецификация | middleware.test.ts |
| 30 | API: пагинация | middleware.test.ts, lib.test.ts |
| 31 | API: валидация (Zod) | middleware.test.ts |
| 32 | Accessibility | web.test.ts |
| 33 | UI Kit / Design System | web.test.ts |
| 34 | Структура проекта | vitest.workspace.ts |
| 35 | Запрещённые решения | workspace.test.ts, sources.test.ts, generation.test.ts |
| 38 | Требования к данным | database.test.ts |
| 39 | Безопасность | security.test.ts, logs.test.ts |
| 41 | 10 заповедей безопасности | security.test.ts |
| 42 | Критерии приёмки (35) | e2e.test.ts |
| 43 | Заключительные положения | sources.test.ts (запрет Bot API) |

---

## 5. Статистика

| Показатель | Значение |
|---|---|
| Тестовых файлов | 18 |
| Групп `describe` | ~85 |
| Тест-кейсов `it` | ~250+ |
| Пакетов | 4 (api + web + worker + e2e) |
| Модулей API | 13 |
| Middleware | 7 групп |
| Lib-модулей | 5 |
| Сквозных E2E-сценариев | 10 |
| Критериев приёмки | 35 (полное покрытие) |
| Разделов ТЗ покрыто | 33 из 35 (разделы 26 и 36-37 — организационные) |
