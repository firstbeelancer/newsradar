import type { ContentTemplate, NewContentTemplate } from "../../db/types.js";
export declare function createTemplate(data: NewContentTemplate): Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    description: string | null;
    systemPrompt: string;
    userPrompt: string;
    variables: unknown;
    isDefault: boolean;
}>;
export declare function getTemplateById(id: string, workspaceId: string): Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    description: string | null;
    systemPrompt: string;
    userPrompt: string;
    variables: unknown;
    isDefault: boolean;
}>;
export declare function listTemplates(workspaceId: string, params?: {
    type?: string;
}): Promise<ContentTemplate[]>;
export declare function updateTemplate(id: string, workspaceId: string, data: Partial<Pick<ContentTemplate, "name" | "systemPrompt" | "userPrompt" | "variables" | "description" | "isDefault" | "type">>): Promise<{
    id: string;
    name: string;
    type: string;
    systemPrompt: string;
    userPrompt: string;
    variables: unknown;
    description: string | null;
    workspaceId: string;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteTemplate(id: string, workspaceId: string): Promise<{
    deleted: boolean;
}>;
//# sourceMappingURL=service.d.ts.map