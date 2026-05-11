import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
  uniqueIndex,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────
// Layer 1 — Auth & Workspace
// ─────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    name: varchar("name", { length: 255 }),
    googleId: varchar("google_id", { length: 255 }),
    yandexId: varchar("yandex_id", { length: 255 }),
    telegramId: varchar("telegram_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_google_id_idx").on(table.googleId),
    uniqueIndex("users_yandex_id_idx").on(table.yandexId),
    uniqueIndex("users_telegram_id_idx").on(table.telegramId),
  ]
);

export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    plan: varchar("plan", { length: 50 }).default("free").notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspaces_user_id_idx").on(table.userId),
    index("workspaces_plan_idx").on(table.plan),
  ]
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    tokenHash: varchar("token_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("refresh_tokens_user_id_idx").on(table.userId),
    index("refresh_tokens_expires_idx").on(table.expiresAt),
  ]
);

export const operationLogs = pgTable(
  "operation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id"),
    operationType: varchar("operation_type", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }),
    entityId: uuid("entity_id"),
    status: varchar("status", { length: 50 }).notNull(),
    message: text("message"),
    metadata: jsonb("metadata"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("oplogs_user_id_idx").on(table.userId),
    index("oplogs_workspace_id_idx").on(table.workspaceId),
    index("oplogs_agent_id_idx").on(table.agentId),
    index("oplogs_status_idx").on(table.status),
    index("oplogs_created_at_idx").on(table.createdAt),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 2 — Product Skeleton (Agents, Sources, Articles)
// ─────────────────────────────────────────────────────────────

export const subjectAreas = pgTable(
  "subject_areas",
  {
    id: varchar("id", { length: 50 }).primaryKey(), // enum value: cybersec, ai, marketing, medical, design
    label: varchar("label", { length: 100 }).notNull(),
    icon: varchar("icon", { length: 50 }).default("circle").notNull(),
    color: varchar("color", { length: 7 }).default("#3b82f6").notNull(),
    defaultTopic: text("default_topic").notNull(),
    defaultAudience: text("default_audience").notNull(),
    defaultsJson: jsonb("defaults_json").default({}).notNull(), // scoring_weights, chip_filters, gpt_prompts
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("subject_areas_position_idx").on(table.position),
  ]
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 50 }).default("rss").notNull(),
    color: varchar("color", { length: 7 }).default("#3b82f6").notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    subjectArea: varchar("subject_area", { length: 50 }), // references subject_areas.id
    config: jsonb("config").default({}).notNull(), // scoring_weights, chip_filters, gpt_prompts, asset_pack, fetch_schedule
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agents_workspace_id_idx").on(table.workspaceId),
    index("agents_position_idx").on(table.position),
    index("agents_subject_area_idx").on(table.subjectArea),
  ]
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: varchar("type", { length: 10 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    url: text("url").notNull(),
    channelUsername: varchar("channel_username", { length: 100 }),
    isActive: boolean("is_active").default(true).notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    fetchSchedule: varchar("fetch_schedule", { length: 100 }), // cron expression
    fetchCount: integer("fetch_count").default(0).notNull(),
    lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
    lastError: text("last_error"),
    errorCount: integer("error_count").default(0).notNull(),
    fetchStatus: varchar("fetch_status", { length: 16 }).default("never").notNull(),
    health: jsonb("health").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sources_workspace_id_idx").on(table.workspaceId),
    index("sources_type_idx").on(table.type),
    index("sources_is_active_idx").on(table.isActive),
    index("sources_fetch_status_idx").on(table.fetchStatus),
    check("sources_type_check", sql`${table.type} IN ('rss', 'telegram')`),
  ]
);

export const agentSources = pgTable(
  "agent_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "cascade" })
      .notNull(),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
  },
  (table) => [
    uniqueIndex("agent_sources_unique_idx").on(table.agentId, table.sourceId),
    index("agent_sources_agent_id_idx").on(table.agentId),
    index("agent_sources_source_id_idx").on(table.sourceId),
  ]
);

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    content: text("content"),
    // Original fields for translation support
    originalTitle: text("original_title"),
    originalDescription: text("original_description"),
    detectedLang: varchar("detected_lang", { length: 10 }),
    needsTranslation: boolean("needs_translation").default(false).notNull(),
    //
    link: text("link").notNull(),
    guid: text("guid"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    author: text("author"),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "cascade" })
      .notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 16 }).default("new").notNull(),
    aiSummary: text("ai_summary"),
    category: varchar("category", { length: 50 }),
    language: varchar("language", { length: 10 }).default("ru").notNull(),
    score: decimal("score", { precision: 5, scale: 3 }).default("0.000").notNull(),
    scoreDetail: jsonb("score_detail").default({}).notNull(),
    isRelevant: boolean("is_relevant"),
    relevanceReason: text("relevance_reason"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    rawHash: text("raw_hash"),
    semanticGroupId: uuid("semantic_group_id"),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).defaultNow().notNull(),
    ttlExpiresAt: timestamp("ttl_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("articles_source_id_idx").on(table.sourceId),
    index("articles_agent_id_idx").on(table.agentId),
    index("articles_workspace_id_idx").on(table.workspaceId),
    index("articles_status_idx").on(table.status),
    index("articles_score_idx").on(table.score),
    index("articles_is_favorite_idx").on(table.isFavorite),
    index("articles_published_at_idx").on(table.publishedAt),
    index("articles_ordered_at_idx").on(table.orderedAt),
    index("articles_created_at_idx").on(table.createdAt),
    index("articles_raw_hash_idx").on(table.rawHash),
    index("articles_semantic_group_id_idx").on(table.semanticGroupId),
    // Full-text search GIN index
    index("articles_fts_idx")
      .using("gin", sql`to_tsvector('russian', ${table.title} || ' ' || COALESCE(${table.description}, ''))`),
    check("articles_status_check", sql`${table.status} IN ('new', 'fetched', 'translated', 'analyzed', 'scored', 'deduped', 'published', 'archived')`),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 3 — AI Providers + Scoring
// ─────────────────────────────────────────────────────────────

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(), // platform, byok
    provider: varchar("provider", { length: 20 }).notNull(), // openai, anthropic, openrouter, google
    baseUrl: text("base_url"),
    apiKeyEncrypted: text("api_key_encrypted"),
    model: varchar("model", { length: 100 }).default("gpt-4o-mini").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_providers_workspace_id_idx").on(table.workspaceId),
    index("ai_providers_is_active_idx").on(table.isActive),
    check("ai_providers_type_check", sql`${table.type} IN ('platform', 'byok')`),
    check(
      "ai_providers_provider_check",
      sql`${table.provider} IN ('openai', 'anthropic', 'openrouter', 'google')`
    ),
  ]
);

export const articleScores = pgTable(
  "article_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    aiRelevance: decimal("ai_relevance", { precision: 3, scale: 2 }),
    keywordMatch: decimal("keyword_match", { precision: 3, scale: 2 }),
    freshness: decimal("freshness", { precision: 3, scale: 2 }),
    sourceTrust: decimal("source_trust", { precision: 3, scale: 2 }),
    // AI sub-criteria (0-100 scale, stored as decimal)
    relevance: decimal("relevance", { precision: 5, scale: 2 }),
    novelty: decimal("novelty", { precision: 5, scale: 2 }),
    hype: decimal("hype", { precision: 5, scale: 2 }),
    practical: decimal("practical", { precision: 5, scale: 2 }),
    local: decimal("local", { precision: 5, scale: 2 }),
    overallScore: decimal("overall_score", { precision: 5, scale: 3 }).default("0.000").notNull(),
    weightedScore: decimal("weighted_score", { precision: 5, scale: 3 }).default("0.000").notNull(),
    weightsSnapshot: jsonb("weights_snapshot"),
    chips: jsonb("chips").default("[]").notNull(),
    scoreDetail: jsonb("score_detail").default({}).notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("article_scores_article_id_idx").on(table.articleId),
    index("article_scores_overall_idx").on(table.overallScore),
    index("article_scores_weighted_idx").on(table.weightedScore),
  ]
);

export const workspaceScoringConfig = pgTable(
  "workspace_scoring_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    // Legacy 4-criteria weights (kept for backward compatibility)
    aiRelevance: decimal("ai_relevance", { precision: 5, scale: 4 }).default("0.3500").notNull(),
    keywordMatch: decimal("keyword_match", { precision: 5, scale: 4 }).default("0.2500").notNull(),
    freshness: decimal("freshness", { precision: 5, scale: 4 }).default("0.2000").notNull(),
    sourceTrust: decimal("source_trust", { precision: 5, scale: 4 }).default("0.2000").notNull(),
    // Meta weights for hybrid formula: ai_score, keyword_score, freshness_score, source_trust_score
    aiWeight: decimal("ai_weight", { precision: 5, scale: 4 }).default("0.5500").notNull(),
    keywordWeight: decimal("keyword_weight", { precision: 5, scale: 4 }).default("0.2000").notNull(),
    freshnessWeight: decimal("freshness_weight", { precision: 5, scale: 4 }).default("0.1500").notNull(),
    sourceTrustWeight: decimal("source_trust_weight", { precision: 5, scale: 4 }).default("0.1000").notNull(),
    // AI sub-criteria weights: { relevance: 30, novelty: 25, hype: 15, practical: 20, local: 10 }
    scoringWeights: jsonb("scoring_weights").default("{}").notNull(),
    chipFilters: jsonb("chip_filters").default("{}").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("workspace_scoring_config_workspace_id_idx").on(table.workspaceId),
  ]
);

export const scoringCriteria = pgTable(
  "scoring_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "cascade" })
      .notNull(),
    criterionType: varchar("criterion_type", { length: 50 }).notNull(), // ai_relevance, keyword_match, freshness, source_trust, custom
    label: varchar("label", { length: 100 }).notNull(),
    weight: decimal("weight", { precision: 5, scale: 4 }).default("0.0000").notNull(),
    threshold: decimal("threshold", { precision: 5, scale: 4 }),
    config: jsonb("config").default({}).notNull(),
    position: integer("position").default(0).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("scoring_criteria_agent_id_idx").on(table.agentId),
    index("scoring_criteria_type_idx").on(table.criterionType),
    check("scoring_criteria_type_check", sql`${table.criterionType} IN ('ai_relevance', 'keyword_match', 'freshness', 'source_trust', 'custom')`),
    check("scoring_criteria_weight_check", sql`${table.weight} >= 0 AND ${table.weight} <= 1`),
  ]
);

export const chipFilters = pgTable(
  "chip_filters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "cascade" })
      .notNull(),
    key: varchar("key", { length: 50 }).notNull(),
    label: varchar("label", { length: 100 }).notNull(),
    description: text("description"),
    pattern: text("pattern"),
    operator: varchar("operator", { length: 20 }).default("contains").notNull(),
    scoreModifier: decimal("score_modifier", { precision: 5, scale: 4 }).default("0.0000").notNull(),
    color: varchar("color", { length: 20 }).default("default").notNull(),
    icon: varchar("icon", { length: 50 }),
    threshold: decimal("threshold", { precision: 5, scale: 4 }),
    isActive: boolean("is_active").default(true).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("chip_filters_agent_id_idx").on(table.agentId),
    index("chip_filters_key_idx").on(table.key),
    uniqueIndex("chip_filters_agent_key_unique_idx").on(table.agentId, table.key),
    check("chip_filters_operator_check", sql`${table.operator} IN ('contains', 'not_contains', 'equals', 'starts_with', 'regex', 'in', 'gt', 'lt', 'gte', 'lte')`),
  ]
);

export const articleFingerprints = pgTable(
  "article_fingerprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    fingerprintHash: varchar("fingerprint_hash", { length: 255 }).notNull(),
    fingerprintType: varchar("fingerprint_type", { length: 20 }).notNull(), // url_hash, guid, title_hash, semantic
    sourceGuid: varchar("source_guid", { length: 500 }),
    canonicalUrl: text("canonical_url"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("article_fingerprints_hash_type_unique").on(table.fingerprintHash, table.fingerprintType),
    index("article_fingerprints_article_id_idx").on(table.articleId),
    index("article_fingerprints_expires_idx").on(table.expiresAt),
    check("article_fingerprints_type_check", sql`${table.fingerprintType} IN ('url_hash', 'guid', 'title_hash', 'semantic')`),
  ]
);

export const favoriteArticles = pgTable(
  "favorite_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "set null" }),
    sourceId: uuid("source_id")
      .references(() => sources.id, { onDelete: "set null" }),
    ttlMode: varchar("ttl_mode", { length: 10 }).default("30d").notNull(), // 30d, forever
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    note: text("note"),
    scoreAtFavorite: decimal("score_at_favorite", { precision: 5, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("favorite_articles_workspace_article_unique").on(table.workspaceId, table.articleId),
    index("favorite_articles_workspace_id_idx").on(table.workspaceId),
    index("favorite_articles_article_id_idx").on(table.articleId),
    index("favorite_articles_expires_at_idx").on(table.expiresAt),
    check("favorite_articles_ttl_mode_check", sql`${table.ttlMode} IN ('30d', 'forever')`),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 4 — Generation (Templates, Generated Posts)
// ─────────────────────────────────────────────────────────────

export const contentTemplates = pgTable(
  "content_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    systemPrompt: text("system_prompt").notNull(),
    userPrompt: text("user_prompt").default("{{content}}").notNull(),
    variables: jsonb("variables").default("[]").notNull(),
    description: text("description"),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("content_templates_workspace_id_idx").on(table.workspaceId),
    index("content_templates_type_idx").on(table.type),
    check("content_templates_type_check", sql`${table.type} IN ('short', 'detailed', 'digest')`),
  ]
);

export const generatedPosts = pgTable(
  "generated_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title"),
    content: text("content").notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    articleCount: integer("article_count").default(0).notNull(),
    templateId: uuid("template_id").references(() => contentTemplates.id, { onDelete: "set null" }),
    articlesSnapshot: jsonb("articles_snapshot").default("[]").notNull(),
    promptSnapshot: text("prompt_snapshot"),
    modelSnapshot: varchar("model_snapshot", { length: 100 }),
    isEdited: boolean("is_edited").default(false).notNull(),
    isCopied: boolean("is_copied").default(false).notNull(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id").references(() => agents.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("generated_posts_workspace_id_idx").on(table.workspaceId),
    index("generated_posts_agent_id_idx").on(table.agentId),
    index("generated_posts_template_id_idx").on(table.templateId),
    index("generated_posts_type_idx").on(table.type),
    index("generated_posts_created_at_idx").on(table.createdAt),
    check("generated_posts_type_check", sql`${table.type} IN ('manual', 'digest', 'deepsearch')`),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 5 — Notifications & Rules
// ─────────────────────────────────────────────────────────────

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notifications_workspace_id_idx").on(table.workspaceId),
    index("notifications_type_idx").on(table.type),
    index("notifications_is_read_idx").on(table.isRead),
    index("notifications_created_at_idx").on(table.createdAt),
    check(
      "notifications_type_check",
      sql`${table.type} IN ('collection_done', 'generation_done', 'error', 'limit_80', 'subscription_expiring', 'downgrade_complete')`
    ),
  ]
);

export const notificationRules = pgTable(
  "notification_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    channel: varchar("channel", { length: 20 }).notNull(), // telegram, email, web
    threshold: decimal("threshold", { precision: 5, scale: 3 }),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("notification_rules_workspace_id_idx").on(table.workspaceId),
    index("notification_rules_agent_id_idx").on(table.agentId),
    check("notification_rules_channel_check", sql`${table.channel} IN ('telegram', 'email', 'web')`),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 6 — Subscriptions & Usage
// ─────────────────────────────────────────────────────────────

export const subscriptionPayments = pgTable(
  "subscription_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar("provider", { length: 20 }).notNull(),
    providerPaymentId: text("provider_payment_id"),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("RUB").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    plan: varchar("plan", { length: 10 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sub_payments_workspace_id_idx").on(table.workspaceId),
    index("sub_payments_status_idx").on(table.status),
    check("sub_payments_provider_check", sql`${table.provider} IN ('yookassa')`),
    check("sub_payments_status_check", sql`${table.status} IN ('pending', 'succeeded', 'cancelled', 'refunded')`),
    check("sub_payments_plan_check", sql`${table.plan} IN ('monthly', 'yearly')`),
  ]
);

export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    used: integer("used").default(0).notNull(),
    limit: integer("limit").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("usage_counters_workspace_type_idx").on(table.workspaceId, table.type),
    index("usage_counters_period_idx").on(table.periodEnd),
    check(
      "usage_counters_type_check",
      sql`${table.type} IN ('favorites', 'collections', 'digests', 'deepsearches', 'posts')`
    ),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 7 — Assets
// ─────────────────────────────────────────────────────────────

export const assetPacks = pgTable(
  "asset_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    s3Prefix: varchar("s3_prefix", { length: 255 }),
    itemCount: integer("item_count").default(0).notNull(),
    maxItems: integer("max_items").default(100).notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("asset_packs_workspace_id_idx").on(table.workspaceId),
  ]
);

export const assetItems = pgTable(
  "asset_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packId: uuid("pack_id")
      .references(() => assetPacks.id, { onDelete: "cascade" })
      .notNull(),
    type: varchar("type", { length: 20 }).notNull(), // emoji, icon, color, font_size, layout
    name: varchar("name", { length: 100 }).notNull(),
    value: text("value").notNull(), // emoji char, icon name, hex color, etc
    label: varchar("label", { length: 200 }),
    metadata: jsonb("metadata").default({}).notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("asset_items_pack_id_idx").on(table.packId),
    check("asset_items_type_check", sql`${table.type} IN ('emoji', 'icon', 'color', 'font_size', 'layout')`),
    uniqueIndex("asset_items_pack_name_unique").on(table.packId, table.name),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 8 — Fetch Schedules
// ─────────────────────────────────────────────────────────────

export const fetchSchedules = pgTable(
  "fetch_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
    preset: varchar("preset", { length: 20 }), // every_hour, every_6h, every_day, custom
    isActive: boolean("is_active").default(true).notNull(),
    description: text("description"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("fetch_schedules_workspace_id_idx").on(table.workspaceId),
    index("fetch_schedules_next_run_idx").on(table.nextRunAt),
    check(
      "fetch_schedules_preset_check",
      sql`${table.preset} IN ('every_hour', 'every_6h', 'every_day', 'custom')`
    ),
  ]
);

// ─────────────────────────────────────────────────────────────
// Layer 9 — DeepSearch Results
// ─────────────────────────────────────────────────────────────

export const deepsearchResults = pgTable(
  "deepsearch_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    agentId: uuid("agent_id")
      .references(() => agents.id, { onDelete: "cascade" })
      .notNull(),
    query: text("query").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, running, completed, failed
    findings: jsonb("findings").default({}).notNull(),
    reportText: text("report_text"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("deepsearch_results_workspace_id_idx").on(table.workspaceId),
    index("deepsearch_results_agent_id_idx").on(table.agentId),
    index("deepsearch_results_status_idx").on(table.status),
    index("deepsearch_results_created_at_idx").on(table.createdAt),
    check(
      "deepsearch_results_status_check",
      sql`${table.status} IN ('pending', 'running', 'completed', 'failed')`
    ),
  ]
);