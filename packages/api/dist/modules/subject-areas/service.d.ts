import type { SubjectArea } from "../../db/types.js";
export declare function listSubjectAreas(workspaceId?: string): Promise<SubjectArea[]>;
export declare function getSubjectAreaById(id: string): Promise<SubjectArea>;
export declare function updateSubjectAreaDefaults(id: string, data: {
    defaultTopic?: string;
    defaultAudience?: string;
    defaultsJson?: Record<string, unknown>;
    icon?: string;
    color?: string;
}): Promise<SubjectArea>;
//# sourceMappingURL=service.d.ts.map