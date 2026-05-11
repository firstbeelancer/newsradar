import { create } from 'zustand';
import { scoringApi, templatesApi, type ScoringConfig, type AIScoringWeights, type Template, type CreateTemplateDto } from '@shared/api/client';

interface SettingsState {
  // Scoring
  scoringConfig: ScoringConfig | null;
  isScoringLoading: boolean;
  isRecalculating: boolean;

  // Templates
  templates: Template[];
  isTemplatesLoading: boolean;
  isTemplateSubmitting: boolean;

  // UI
  error: string | null;
}

interface SettingsActions {
  // Scoring
  fetchScoringConfig: () => Promise<void>;
  updateScoringConfig: (config: ScoringConfig) => Promise<void>;
  recalculateScoring: () => Promise<void>;

  // Templates
  fetchTemplates: () => Promise<void>;
  createTemplate: (data: CreateTemplateDto) => Promise<void>;
  updateTemplate: (id: string, data: Partial<CreateTemplateDto>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;

  clearError: () => void;
}

const DEFAULT_AI_WEIGHTS: AIScoringWeights = {
  relevance: 30,
  novelty: 25,
  hype: 15,
  practical: 20,
  local: 10,
};

const initialState: SettingsState = {
  scoringConfig: null,
  isScoringLoading: false,
  isRecalculating: false,
  templates: [],
  isTemplatesLoading: false,
  isTemplateSubmitting: false,
  error: null,
};

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  ...initialState,

  fetchScoringConfig: async () => {
    set({ isScoringLoading: true, error: null });
    try {
      const config = await scoringApi.getConfig();
      // Ensure scoring_weights has defaults
      if (!config.scoring_weights) {
        config.scoring_weights = DEFAULT_AI_WEIGHTS;
      }
      set({ scoringConfig: config, isScoringLoading: false });
    } catch (err) {
      // Set default config on error
      set({
        scoringConfig: {
          ai_relevance: 0.35,
          keyword_match: 0.25,
          freshness: 0.20,
          source_trust: 0.20,
          ai_weight: 0.55,
          keyword_weight: 0.20,
          freshness_weight: 0.15,
          source_trust_weight: 0.10,
          scoring_weights: DEFAULT_AI_WEIGHTS,
        },
        isScoringLoading: false,
        error: err instanceof Error ? err.message : 'Ошибка загрузки конфигурации скоринга',
      });
    }
  },

  updateScoringConfig: async (config) => {
    set({ isScoringLoading: true, error: null });
    try {
      const updated = await scoringApi.updateConfig(config);
      if (!updated.scoring_weights) {
        updated.scoring_weights = DEFAULT_AI_WEIGHTS;
      }
      set({ scoringConfig: updated, isScoringLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка обновления конфигурации',
        isScoringLoading: false,
      });
      throw err;
    }
  },

  recalculateScoring: async () => {
    set({ isRecalculating: true, error: null });
    try {
      await scoringApi.recalculate();
      set({ isRecalculating: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка перескоринга',
        isRecalculating: false,
      });
      throw err;
    }
  },

  fetchTemplates: async () => {
    set({ isTemplatesLoading: true, error: null });
    try {
      const templates = await templatesApi.list();
      set({ templates, isTemplatesLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка загрузки шаблонов',
        isTemplatesLoading: false,
      });
    }
  },

  createTemplate: async (data) => {
    set({ isTemplateSubmitting: true, error: null });
    try {
      const template = await templatesApi.create(data);
      set((state) => ({
        templates: [...state.templates, template],
        isTemplateSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка создания шаблона',
        isTemplateSubmitting: false,
      });
      throw err;
    }
  },

  updateTemplate: async (id, data) => {
    set({ isTemplateSubmitting: true, error: null });
    try {
      const updated = await templatesApi.update(id, data);
      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? updated : t)),
        isTemplateSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка обновления шаблона',
        isTemplateSubmitting: false,
      });
      throw err;
    }
  },

  deleteTemplate: async (id) => {
    set({ isTemplateSubmitting: true, error: null });
    try {
      await templatesApi.delete(id);
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        isTemplateSubmitting: false,
      }));
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка удаления шаблона',
        isTemplateSubmitting: false,
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
