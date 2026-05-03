# Newsradar

PWA для сбора новостей из RSS и Telegram, AI-скоринга и генерации постов.

---

## 🚀 Деплой через Coolify

### 1. Подготовка

- Убедись, что Coolify установлен и запущен
- Твой GitHub аккаунт подключён к Coolify (Settings → Source → GitHub App)

### 2. Создание проекта в Coolify

1. **Create Resource → Docker Compose**
2. **Repository:** `firstbeelancer/newsradar`
3. **Branch:** `main`
4. **Build Pack:** Docker Compose
5. **Docker Compose Location:** `/docker-compose.yml`
6. **Base Directory:** `/`

### 3. Настройка переменных окружения

В Coolify → Project → Environment Variables, добавь **обязательные**:

| Переменная | Описание | Пример |
|-----------|----------|--------|
| `DB_PASS` | Пароль PostgreSQL | `strong_random_password_32` |
| `JWT_SECRET` | Секрет JWT (мин. 32 символа) | `change-me-in-production-min-32-chars-long` |
| `ENCRYPTION_KEY` | AES-256-GCM ключ (64 hex chars) | `a1b2c3d4...64chars` |
| `DOMAIN` | Твой домен | `newsradar.example.com` |

**Опциональные** (для полной функциональности):

| Переменная | Для чего |
|-----------|----------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `YANDEX_CLIENT_ID` / `YANDEX_CLIENT_SECRET` | OAuth Yandex |
| `PLATFORM_AI_API_KEY` | AI генерация (OpenRouter key) |
| `YOOKASSA_SHOP_ID` / `YOOKASSA_SECRET_KEY` | Платежи |
| `S3_ENDPOINT` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_BUCKET` | S3 хранилище |

### 4. Настройка доменов

Coolify сам назначит домены для сервисов с портами:

| Сервис | Порт | Домен (пример) |
|--------|------|----------------|
| `web` | 80 | `newsradar.example.com` |
| `api` | 3001 | `api.newsradar.example.com` |

В Coolify → Services → [service] → Settings → Domains:
- `web`: `https://newsradar.example.com`
- `api`: `https://api.newsradar.example.com`

### 5. Первый деплой

Нажми **Deploy**. Coolify:
1. Клонирует репо
2. Соберёт Docker образы (API, Web, Worker)
3. Запустит PostgreSQL + Redis
4. Запустит API + Worker + Web (nginx)
5. Подключит домены и SSL

**Время деплоя:** ~3-5 минут

### 6. Проверка

```bash
# Health check API
curl https://api.newsradar.example.com/api/v1/health

# Должен вернуть:
# { "status": "ok", "app": "newsradar", "version": "3.2.0" }
```

### 7. Миграция БД (первый запуск)

```bash
# В Coolify Terminal или через SSH на сервер
docker exec -it newsradar-api sh
npx drizzle-kit migrate
```

Или добавь в `docker-compose.yml` `command` для API с авто-миграцией:
```yaml
api:
  command: ["sh", "-c", "npx drizzle-kit migrate && node dist/index.js"]
```

### 8. Авторедеплой

В Coolify → Project → Settings:
- ✅ **Auto Deploy** — включить
- Coolify автоматически редеплоит при push в `main`

Webhook настроится автоматически через GitHub App.

---

## 🏗️ Архитектура

```
newsradar/
├── packages/
│   ├── api/          # Express + Drizzle ORM (порт 3001)
│   ├── web/          # React + Vite → nginx static (порт 80)
│   └── worker/       # BullMQ background jobs (без порта)
├── docker-compose.yml
└── .env.example
```

**Базы данных:**
- PostgreSQL 16 — основная БД
- Redis 7 — очереди BullMQ + SSE pub/sub

---

## 🧪 Тесты

```bash
# Локально
npx vitest run

# Результат: 579 тестов, 18 файлов, 100% passed
```

---

## 🔐 Безопасность

- JWT access token: 15 минут
- Refresh token: 30 дней, httpOnly cookie
- AES-256-GCM шифрование API ключей
- Rate limiting: 100 req/min
- SSRF защита на источники
- SQL injection: защита Drizzle ORM (parameterized queries)

---

## 📄 Лицензия

Private — только для авторизованных пользователей.
