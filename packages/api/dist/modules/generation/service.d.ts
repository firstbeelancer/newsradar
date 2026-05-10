import type { PaginatedResult } from "../../lib/pagination.js";
import type { GeneratedPost } from "../../db/types.js";
export interface GeneratePostInput {
    workspaceId: string;
    agentId?: string;
    templateId?: string;
    articleIds?: string[];
    customPrompt?: string;
    type: "manual" | "digest" | "deepsearch";
}
export interface StreamOperation {
    id: string;
    status: "pending" | "generating" | "completed" | "error";
    content: string;
    error?: string;
    chunks: string[];
}
export declare function generatePost(input: GeneratePostInput, _userId: string): Promise<{
    operationId: string;
    status: string;
}>;
export declare function getStreamOperation(operationId: string): StreamOperation | undefined;
export declare function cleanupStreamOperation(operationId: string): void;
export declare function listGeneratedPosts(workspaceId: string, params: {
    limit: number;
    cursor?: string | null;
    agentId?: string;
    type?: string;
}): Promise<PaginatedResult<GeneratedPost>>;
export declare function getGeneratedPost(id: string, workspaceId: string): Promise<{
    type: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    agentId: string | null;
    title: string | null;
    content: string;
    articleCount: number;
    templateId: string | null;
    articlesSnapshot: unknown;
    promptSnapshot: string | null;
    modelSnapshot: string | null;
    isEdited: boolean;
    isCopied: boolean;
}>;
export declare function updateGeneratedPost(id: string, workspaceId: string, data: {
    title?: string;
    content?: string;
}): Promise<{
    id: string;
    title: string | null;
    content: string;
    type: string;
    articleCount: number;
    templateId: string | null;
    articlesSnapshot: unknown;
    promptSnapshot: string | null;
    modelSnapshot: string | null;
    isEdited: boolean;
    isCopied: boolean;
    workspaceId: string;
    agentId: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteGeneratedPost(id: string, workspaceId: string): Promise<{
    deleted: boolean;
}>;
export declare function markAsCopied(id: string, workspaceId: string): Promise<{
    id: string;
    title: string | null;
    content: string;
    type: string;
    articleCount: number;
    templateId: string | null;
    articlesSnapshot: unknown;
    promptSnapshot: string | null;
    modelSnapshot: string | null;
    isEdited: boolean;
    isCopied: boolean;
    workspaceId: string;
    agentId: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
//# sourceMappingURL=service.d.ts.map