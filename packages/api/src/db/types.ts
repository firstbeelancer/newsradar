import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import { users, workspaces, refreshTokens, operationLogs } from "./schema.js";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;

export type RefreshToken = InferSelectModel<typeof refreshTokens>;
export type NewRefreshToken = InferInsertModel<typeof refreshTokens>;

export type OperationLog = InferSelectModel<typeof operationLogs>;
export type NewOperationLog = InferInsertModel<typeof operationLogs>;
