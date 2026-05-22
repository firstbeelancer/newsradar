import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generationApi, type GeneratePostDto, type GenerateDigestDto, type GeneratedPost, type GenerationStreamState } from '@shared/api/client';

type GenerationType = 'post' | 'digest' | null;

interface GenerationState {
  // UI state
  generationType: GenerationType;
  selectedArticleIds: string[];
  selectedAgentId: string | null;
  selectedPeriod: 'day' | 'week' | 'month';
  selectedTemplateId: string | null;
  selectedProvider: string;
  selectedModel: string;

  // Stream state
  streamContent: string;
  isStreaming: boolean;
  streamError: string | null;

  // Generation state
  generationResult: string;
  isGenerating: boolean;
  lastGeneratedPost: GeneratedPost | null;
  opId: string | null;

  // History
  historyCursor: string | undefined;

  error: string | null;
}

interface GenerationActions {
  setGenerationType: (type: GenerationType) => void;
  setSelectedArticleIds: (ids: string[]) => void;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedPeriod: (period: 'day' | 'week' | 'month') => void;
  setSelectedTemplateId: (id: string | null) => void;
  setSelectedProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;
  initFromProvider: (provider: string, model: string) => void;

  generatePost: (dto?: Partial<GeneratePostDto>) => Promise<void>;
  generateDigest: (dto?: Partial<GenerateDigestDto>) => Promise<void>;
  startStream: (opId: string) => (() => void);
  setGenerationResult: (content: string) => void;
  resetGeneration: () => void;

  setHistoryCursor: (cursor: string | undefined) => void;
  clearError: () => void;
}

const initialState: GenerationState = {
  generationType: null,
  selectedArticleIds: [],
  selectedAgentId: null,
  selectedPeriod: 'day',
  selectedTemplateId: null,
  selectedProvider: 'openai',
  selectedModel: 'gpt-4o-mini',

  streamContent: '',
  isStreaming: false,
  streamError: null,

  generationResult: '',
  isGenerating: false,
  lastGeneratedPost: null,
  opId: null,

  historyCursor: undefined,

  error: null,
};

export const useGenerationStore = create<GenerationState & GenerationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setGenerationType: (type) => set({ generationType: type }),
      setSelectedArticleIds: (ids) => set({ selectedArticleIds: ids }),
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
      setSelectedPeriod: (period) => set({ selectedPeriod: period }),
      setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      initFromProvider: (provider, model) => set({ selectedProvider: provider, selectedModel: model }),

      generatePost: async (dto) => {
        const state = get();
        set({ isGenerating: true, error: null, streamContent: '', generationResult: '', opId: null });
        try {
          const result = await generationApi.generatePost({
            article_ids: dto?.article_ids ?? state.selectedArticleIds,
            template_id: dto?.template_id ?? state.selectedTemplateId ?? undefined,
            provider: dto?.provider ?? state.selectedProvider,
            model: dto?.model ?? state.selectedModel,
          });
          set({ opId: result.op_id, isGenerating: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Ошибка генерации',
            isGenerating: false,
          });
          throw err;
        }
      },

      generateDigest: async (dto) => {
        const state = get();
        set({ isGenerating: true, error: null, streamContent: '', generationResult: '', opId: null });
        try {
          const result = await generationApi.generateDigest({
            agent_id: dto?.agent_id ?? state.selectedAgentId ?? '',
            article_ids: dto?.article_ids ?? state.selectedArticleIds,
            article_count: dto?.article_count,
            period: dto?.period ?? state.selectedPeriod,
            template_id: dto?.template_id ?? state.selectedTemplateId ?? undefined,
            provider: dto?.provider ?? state.selectedProvider,
            model: dto?.model ?? state.selectedModel,
          });
          set({ opId: result.op_id, isGenerating: false });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Ошибка генерации',
            isGenerating: false,
          });
          throw err;
        }
      },

      startStream: (opId) => {
        set({ isStreaming: true, streamContent: '', streamError: null });

        const unsubscribe = generationApi.stream(
          opId,
          (state: GenerationStreamState) => {
            if (state.status === 'error') {
              set({ isStreaming: false, streamError: state.error ?? 'Ошибка генерации' });
              return;
            }
            set({
              streamContent: state.content || '',
              isStreaming: state.status === 'generating' || state.status === 'pending',
            });
            if (state.status === 'completed') {
              set({ isStreaming: false, generationResult: state.content });
            }
          },
          (error) => {
            set({ isStreaming: false, streamError: 'Ошибка потокового соединения' });
            console.error('SSE error:', error);
          }
        );

        return () => {
          unsubscribe();
          set({ isStreaming: false });
        };
      },

      setGenerationResult: (content) => set({ generationResult: content }),

      resetGeneration: () => set({
        streamContent: '',
        generationResult: '',
        isGenerating: false,
        isStreaming: false,
        opId: null,
        error: null,
        streamError: null,
      }),

      setHistoryCursor: (cursor) => set({ historyCursor: cursor }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'generation-settings',
      // Only persist provider/model selections — not transient runtime state
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
      }),
    }
  )
);
