import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import {
  users,
  workspaces,
  refreshTokens,
  operationLogs,
  agents,
  sources,
  agentSources,
  articles,
  articleScores,
  aiProviders,
  contentTemplates,
  generatedPosts,
  subscriptionPayments,
  usageCounters,
} from "./schema.js";

// Layer 1
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;

export type OperationLog = InferSelectModel<typeof operationLogs>;
export type NewOperationLog = InferInsertModel<typeof operationLogs>;

// Layer 2
export type Agent = InferSelectModel<typeof agents>;
export type NewAgent = InferInsertModel<typeof agents>;

export type Source = InferSelectModel<typeof sources>;
export type NewSource = InferInsertModel<typeof sources>;

export type AgentSource = InferSelectModel<typeof agentSources>;
export type NewAgentSource = InferInsertModel<typeof agentSources>;

export type Article = InferSelectModel<typeof articles>;
export type NewArticle = InferInsertModel<typeof articles>;

// Layer 3
export type ArticleScore = InferSelectModel<typeof articleScores>;
export type NewArticleScore = InferInsertModel<typeof articleScores>;

export type AiProvider = InferSelectModel<typeof aiProviders>;
export type NewAiProvider = InferInsertModel<typeof aiProviders>;

// Layer 4
export type ContentTemplate = InferSelectModel<typeof contentTemplates>;
export type NewContentTemplate = InferInsertModel<typeof contentTemplates>;

export type GeneratedPost = InferSelectModel<typeof generatedPosts>;
export type NewGeneratedPost = InferInsertModel<typeof generatedPosts>;

// Layer 6
export type SubscriptionPayment = InferSelectModel<typeof subscriptionPayments>;
export type NewSubscriptionPayment = InferInsertModel<typeof subscriptionPayments>;

export type UsageCounter = InferSelectModel<typeof usageCounters>;
export type NewUsageCounter = InferInsertModel<typeof usageCounters>;
