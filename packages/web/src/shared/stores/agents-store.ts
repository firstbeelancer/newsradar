import { create } from 'zustand';
import { agentsApi, dashboardApi, type Agent, type CreateAgentDto, type UpdateAgentDto } from '@shared/api/client';

interface AgentsState {
  agents: Agent[];
  currentAgent: Agent | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
}

interface AgentsActions {
  fetchAgents: () => Promise<void>;
  fetchAgent: (id: string) => Promise<void>;
  createAgent: (data: CreateAgentDto) => Promise<Agent>;
  updateAgent: (id: string, data: UpdateAgentDto) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  collectAgent: (id: string) => Promise<string>;
  collectAllAgents: () => Promise<string>;
  setCurrentAgent: (agent: Agent | null) => void;
  clearError: () => void;
}

const initialState: AgentsState = {
  agents: [],
  currentAgent: null,
  isLoading: false,
  isSubmitting: false,
  error: null,
};

export const useAgentsStore = create<AgentsState & AgentsActions>((set, get) => ({
  ...initialState,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await agentsApi.list();
      // Sort by position
      const sorted = [...response.data].sort((a, b) => a.position - b.position);
      set({ agents: sorted, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки агентов',
        isLoading: false,
      });
    }
  },

  fetchAgent: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const agent = await agentsApi.get(id);
      set({ currentAgent: agent, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки агента',
        isLoading: false,
      });
    }
  },

  createAgent: async (data) => {
    set({ isSubmitting: true, error: null });
    try {
      const agent = await agentsApi.create(data);
      set((state) => ({
        agents: [...state.agents, agent].sort((a, b) => a.position - b.position),
        isSubmitting: false,
      }));
      return agent;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка создания агента',
        isSubmitting: false,
      });
      throw err;
    }
  },

  updateAgent: async (id, data) => {
    set({ isSubmitting: true, error: null });
    try {
      const updated = await agentsApi.update(id, data);
      set((state) => ({
        agents: state.agents.map((a) => (a.id === id ? updated : a)),
        currentAgent: state.currentAgent?.id === id ? updated : state.currentAgent,
        isSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка обновления агента',
        isSubmitting: false,
      });
      throw err;
    }
  },

  deleteAgent: async (id) => {
    set({ isSubmitting: true, error: null });
    try {
      await agentsApi.delete(id);
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
        currentAgent: state.currentAgent?.id === id ? null : state.currentAgent,
        isSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка удаления агента',
        isSubmitting: false,
      });
      throw err;
    }
  },

  collectAgent: async (id) => {
    try {
      const result = await agentsApi.collect(id);
      return result.op_id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Ошибка запуска сбора');
    }
  },

  collectAllAgents: async () => {
    try {
      const result = await dashboardApi.collectAll();
      return result.op_id;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'РћС€РёР±РєР° Р·Р°РїСѓСЃРєР° СЃР±РѕСЂР°');
    }
  },

  setCurrentAgent: (agent) => set({ currentAgent: agent }),
  clearError: () => set({ error: null }),
}));
