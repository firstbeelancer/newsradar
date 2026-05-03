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
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("agents_workspace_id_idx").on(table.workspaceId),
    index("agents_position_idx").on(table.position),
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
    fetchCount: integer("fetch_count").default(0).notNull(),
    lastFetchAt: timestamp("last_fetch_at", { withTimezone: true }),
    lastError: text("last_error"),
    errorCount: integer("error_count").default(0).notNull(),
    fetchStatus: varchar("fetch_status", { length: 16 }).default("never").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("sources_workspace_id_idx").on(table.workspaceId),
    index("sources_type_idx").on(table.type),
    index("sources_is_active_idx").on(table.isActive),
    index("sources_fetch_status_idx").on(table.fetchStatus),
    check("sources_type_check", sql`${table.type} IN ('rss', 'telegram')`),
    check("sources_fetch_status_check", sql`${table.fetchStatus} IN ('never', 'success', 'error')`),
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
    isRelevant: boolean("is_relevant"),
    relevanceReason: text("relevance_reason"),
    isFavorite: boolean("is_favorite").default(false).notNull(),
    rawHash: text("raw_hash"),
    semanticGroupId: uuid("semantic_group_id"),
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
// Layer 3 — AI + Scoring
// ─────────────────────────────────────────────────────────────

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
    overallScore: decimal("overall_score", { precision: 5, scale: 3 }).default("0.000").notNull(),
    weightedScore: decimal("weighted_score", { precision: 5, scale: 3 }).default("0.000").notNull(),
    weightsSnapshot: jsonb("weights_snapshot"),
    chips: jsonb("chips").default("[]").notNull(),
    scoredAt: timestamp("scored_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("article_scores_article_id_idx").on(table.articleId),
    index("article_scores_overall_idx").on(table.overallScore),
    index("article_scores_weighted_idx").on(table.weightedScore),
  ]
);

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 16 }).notNull(),
    provider: varchar("provider", { length: 20 }).notNull(),
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
    check("ai_providers_provider_check", sql`${table.provider} IN ('openai', 'anthropic', 'openrouter', 'google')`),
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
// Layer 5 — Notifications
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
    check("notifications_type_check", sql`${table.type} IN ('collection_done', 'generation_done', 'error', 'limit_80', 'subscription_expiring', 'downgrade_complete')`),
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
    check("usage_counters_type_check", sql`${table.type} IN ('favorites', 'collections', 'digests', 'deepsearches', 'posts')`),
  ]
);
