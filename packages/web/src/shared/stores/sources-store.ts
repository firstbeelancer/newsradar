import { create } from 'zustand';
import { sourcesApi, agentsApi, type Source, type CreateSourceDto, type UpdateSourceDto, type SourceTestResult } from '@shared/api/client';

interface SourcesState {
  sources: Source[];
  currentSource: Source | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isTesting: boolean;
  testResult: SourceTestResult | null;
  error: string | null;
}

interface SourcesActions {
  fetchSources: () => Promise<void>;
  fetchSourcesByAgent: (agentId: string) => Promise<void>;
  createSource: (data: CreateSourceDto) => Promise<Source>;
  updateSource: (id: string, data: UpdateSourceDto) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;
  testSource: (id: string) => Promise<void>;
  fetchSource: (id: string) => Promise<void>;
  setCurrentSource: (source: Source | null) => void;
  clearTestResult: () => void;
  clearError: () => void;
}

const initialState: SourcesState = {
  sources: [],
  currentSource: null,
  isLoading: false,
  isSubmitting: false,
  isTesting: false,
  testResult: null,
  error: null,
};

export const useSourcesStore = create<SourcesState & SourcesActions>((set, get) => ({
  ...initialState,

  fetchSources: async () => {
    set({ isLoading: true, error: null });
    try {
      const sources = await sourcesApi.list();
      set({ sources, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки источников',
        isLoading: false,
      });
    }
  },

  fetchSourcesByAgent: async (agentId) => {
    set({ isLoading: true, error: null });
    try {
      // Use the dedicated agent sources endpoint instead of fetching all
      const sources = await agentsApi.sources(agentId);
      set({ sources, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки источников',
        isLoading: false,
      });
    }
  },

  createSource: async (data) => {
    set({ isSubmitting: true, error: null });
    try {
      const source = await sourcesApi.create(data);
      set((state) => ({ sources: [...state.sources, source], isSubmitting: false }));
      return source;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка создания источника',
        isSubmitting: false,
      });
      throw err;
    }
  },

  updateSource: async (id, data) => {
    set({ isSubmitting: true, error: null });
    try {
      const previous = get().sources.find((source) => source.id === id) ?? null;
      const updated = await sourcesApi.update(id, data);

      const assignmentWasProvided = data.agent_id !== undefined || data.agentId !== undefined;
      if (assignmentWasProvided) {
        const desiredAgentId = data.agent_id ?? data.agentId ?? null;
        const currentAgentIds = previous
          ? Array.from(new Set([
              ...previous.agents.map((agent) => agent.id),
              ...(previous.agent_id ? [previous.agent_id] : []),
            ]))
          : [];

        if (desiredAgentId && !currentAgentIds.includes(desiredAgentId)) {
          await agentsApi.linkSource(desiredAgentId, id);
        }
        await Promise.all(
          currentAgentIds
            .filter((agentId) => agentId !== desiredAgentId)
            .map((agentId) => agentsApi.unlinkSource(agentId, id))
        );

        let assignedAgents: Source['agents'] = [];
        if (desiredAgentId) {
          const knownAgent = previous?.agents.find((agent) => agent.id === desiredAgentId);
          if (knownAgent) {
            assignedAgents = [knownAgent];
          } else {
            try {
              const agent = await agentsApi.get(desiredAgentId);
              assignedAgents = [{ id: agent.id, name: agent.name, color: agent.color, icon: agent.icon }];
            } catch {
              assignedAgents = [];
            }
          }
        }

        const reassigned: Source = {
          ...updated,
          agent_id: desiredAgentId ?? '',
          agents: assignedAgents,
        };
        set((state) => ({
          sources: state.sources.map((source) => source.id === id ? reassigned : source),
          currentSource: state.currentSource?.id === id ? reassigned : state.currentSource,
          isSubmitting: false,
        }));
        return;
      }

      set((state) => ({
        sources: state.sources.map((source) => source.id === id
          ? {
              ...updated,
              agent_id: updated.agent_id || source.agent_id,
              agents: updated.agents.length > 0 ? updated.agents : source.agents,
            }
          : source),
        currentSource: state.currentSource?.id === id
          ? {
              ...updated,
              agent_id: updated.agent_id || state.currentSource.agent_id,
              agents: updated.agents.length > 0 ? updated.agents : state.currentSource.agents,
            }
          : state.currentSource,
        isSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка обновления источника',
        isSubmitting: false,
      });
      throw err;
    }
  },

  deleteSource: async (id) => {
    set({ isSubmitting: true, error: null });
    try {
      await sourcesApi.delete(id);
      set((state) => ({
        sources: state.sources.filter((s) => s.id !== id),
        currentSource: state.currentSource?.id === id ? null : state.currentSource,
        isSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка удаления источника',
        isSubmitting: false,
      });
      throw err;
    }
  },

  testSource: async (id) => {
    set({ isTesting: true, testResult: null, error: null });
    try {
      const result = await sourcesApi.test(id);
      set({ testResult: result, isTesting: false });
    } catch (err) {
      set({
        isTesting: false,
        testResult: {
          success: false,
          message: err instanceof Error ? err.message : 'Ошибка тестирования источника',
        },
      });
    }
  },

  fetchSource: async (id) => {
    set({ isLoading: true, error: null });
    try {
      // Try to find in existing list first, otherwise fetch all
      const existing = useSourcesStore.getState().sources.find((s) => s.id === id);
      if (existing) {
        set({ currentSource: existing, isLoading: false });
        return;
      }
      const sources = await sourcesApi.list();
      const source = sources.find((s) => s.id === id) || null;
      set({ currentSource: source, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки источника',
        isLoading: false,
      });
    }
  },

  setCurrentSource: (source) => set({ currentSource: source }),
  clearTestResult: () => set({ testResult: null }),
  clearError: () => set({ error: null }),
}));
