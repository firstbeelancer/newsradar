import type { NewAiProvider } from "../../db/types.js";
export declare function createProvider(data: Omit<NewAiProvider, "apiKeyEncrypted"> & {
    apiKey?: string;
}): Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    isActive: boolean;
    provider: string;
    baseUrl: string | null;
    apiKeyEncrypted: string | null;
    model: string;
}>;
export declare function getProviderById(id: string, workspaceId: string): Promise<{
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    isActive: boolean;
    provider: string;
    baseUrl: string | null;
    apiKeyEncrypted: string | null;
    model: string;
}>;
export declare function listProviders(workspaceId: string): Promise<{
    apiKeyEncrypted: undefined;
    hasKey: boolean;
    type: string;
    name: string;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    workspaceId: string;
    isActive: boolean;
    provider: string;
    baseUrl: string | null;
    model: string;
}[]>;
export declare function updateProvider(id: string, workspaceId: string, data: Partial<{
    name: string;
    model: string;
    baseUrl: string;
    apiKey: string;
    isActive: boolean;
}>): Promise<{
    id: string;
    name: string;
    type: string;
    provider: string;
    baseUrl: string | null;
    apiKeyEncrypted: string | null;
    model: string;
    isActive: boolean;
    workspaceId: string;
    createdAt: Date;
    updatedAt: Date;
}>;
export declare function deleteProvider(id: string, workspaceId: string): Promise<{
    deleted: boolean;
}>;
export declare function testProviderConnection(id: string, workspaceId: string): Promise<{
    success: boolean;
    message: string;
    model?: string;
}>;
//# sourceMappingURL=service.d.ts.map