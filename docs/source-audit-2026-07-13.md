# Аудит источников NewsRadar — 13 июля 2026

## Методика и итог

Проверка выполнена из production-контейнера worker, то есть из той же сети, где идет реальный сбор. Для RSS/Atom проверялись HTTP-ответ, XML-корень и наличие хотя бы одного `<item>` или `<entry>`. Для Telegram проверялось наличие сообщений в публичном preview `t.me/s/...`.

- Всего записей источников: **179**.
- Реально отдали статьи/сообщения: **114**.
- Проблемных записей: **65** — 57 RSS и 8 Telegram.
- До исправления активными оставались 25 проблемных записей.
- `Arenadata Blog` и `КРОК — Блог` возвращают корректный XML, но **0 статей**. Старый тест ошибочно считал их рабочими.
- `Timeweb Cloud Blog` возвращает 590 элементов без даты публикации. Старый код подставлял дату сбора.
- `OpenNET` объявляет `encoding="koi8-r"`; старый код всегда декодировал UTF-8.
- `The Lancet` использует `dc:date`/`prism:publicationDate`, которые старый парсер не читал.

## Исправленные и включенные

В миграции `0011_repair_feed_metadata_and_sources.sql` подтверждены и установлены рабочие адреса:

| Источник | Новый URL |
|---|---|
| A List Apart | `https://alistapart.com/main/feed/` |
| Construction Dive | `https://www.constructiondive.com/feeds/news` |
| Dark Reading | `https://www.darkreading.com/rss.xml` |
| Kaspersky Daily RU | `https://www.kaspersky.ru/blog/feed/` |
| MIT Technology Review AI | `https://www.technologyreview.com/feed/` |
| MWS Cloud Blog | `https://habr.com/ru/rss/companies/mws/articles/?fl=ru` |
| Marketing Land | `https://martech.org/feed/` |
| Medical Xpress | `https://medicalxpress.com/rss-feed/` |
| REG.ru Blog | `https://reg.ru/blog/feed/` |
| SberCloud Blog | `https://habr.com/ru/rss/companies/cloud_ru/articles/?fl=ru` |
| SecurityWeek | `https://www.securityweek.com/feed/` |
| WHO Newsroom | `https://www.who.int/rss-feeds/news-english.xml` |
| Yandex Cloud Blog | `https://habr.com/ru/rss/companies/yandex_cloud_and_infra/articles/?fl=ru` |

Для `The Hacker News` и `VentureBeat AI` в базе уже есть отдельные рабочие канонические записи, связанные с агентами. Старые нерабочие дубли отключены.

## Отключенные после аудита

Рабочей RSS/Atom-замены из production не найдено:

- `Dataline Blog`, `Dribbble Blog`, `Healthline News`, `IT-Костыли`.
- `Medical News Today`, `MinIO Blog`, `Open Observability`, `Pro DNS`.
- `Tencent Cloud Blog`, `The Batch - Andrew Ng`, `Т1 Cloud Blog`.
- `NVD - National Vulnerability Database`: адрес ведет на JSON/GZIP, нужен отдельный JSON-адаптер.
- `PubMed New`: токен сохраненного поиска истек, URL возвращает HTTP 500; RSS нужно заново создать в PubMed.
- `Kubernetes_ru`, `Linux & Co (Telegram)`, `OpenAI (Telegram)`: публичный preview не содержит сообщений.
- Нерабочие дубли `The Hacker News` и `VentureBeat AI`.

`Reddit r/kubernetes` во время массовой проверки вернул HTTP 429. Источник оставлен активным: это временный rate limit, решение — повтор с backoff, а не постоянное отключение.

## Уже отключенные проблемные записи

Эти источники были неактивны до аудита и остаются выключенными:

- `3dnew` (старый дубль), `AIGA Eye on Design`, `AdminShit Blog`, `Aliyun Container Service`.
- `Arenadata Blog` (0 статей), `Aéza Blog`, `CSDN Blog`, `CVE Daily — Critical`.
- `Content Marketing Institute`, `Cyber Media`, `FirstVDS Blog`, `ForumHouse`, `Huawei Cloud Blog`.
- Две записи `Jiqizhixin (机器之心) — AI/Engineering`, `MarketingProfs`.
- Второй старый дубль `Medical Xpress`, две записи `Medscape`, `NIH News Releases`.
- `Remontnik.ru`, `VK Cloud Blog`, `КРОК — Блог` (0 статей), `РемСтрой`.
- `Справочник Строительство`, `Строй Свой Дом`, `Техно Инсайдер`.
- `Хабр — Маркетинг`, `Хабр — Медицина`, `Хабр — Строительство`.
- Telegram: `Cossa`, `Kaspersky Daily`, `OpenSourceNotes`, `RUVDS`, `vc.ru`.

## Рабочие, но намеренно отключенные

- `36Kr DevOps Channel`: технически рабочий, но это общий бизнес-фид, не DevOps. Включение снова даст левые темы.
- `Design Milk`: технически рабочий, но широкий продуктовый/interior-фид; оставлен выключенным из-за нерелевантных материалов для графического дизайна.

## Исправления логики

1. RSS декодируется по BOM, HTTP `charset` и XML `encoding`, включая KOI8-R и Windows-1251.
2. Парсер читает `pubDate`, `dc:date`, `prism:publicationDate`, `published` и `updated`.
3. Для элементов без даты worker ищет `datePublished` на странице статьи; неизвестная дата больше не заменяется временем сбора.
4. После первой подтвержденной старой статьи в недатированном newest-first фиде worker не обходит весь архив.
5. Статьи без подтвержденной даты не сохраняются; интерфейс показывает `Дата не указана`, а не сегодняшнюю дату.
6. Тест источника требует хотя бы одну статью/запись и реально проверяет Telegram preview.
7. Удаляются только заведомо недостоверные записи: 590 Timeweb без даты, 30 Lancet без даты и 12 OpenNET с символом замены кодировки. После этого их можно корректно собрать заново.
