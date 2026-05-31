import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generationApi, type Article, type GeneratePostDto, type GenerateDigestDto, type GeneratedPost, type GenerationStreamState } from '@shared/api/client';

type GenerationType = 'post' | 'digest' | null;

interface GenerationState {
  generationType: GenerationType;
  selectedArticleIds: string[];
  selectedArticleSnapshots: Article[];
  selectedAgentId: string | null;
  selectedPeriod: 'day' | 'week' | 'month';
  selectedTemplateId: string | null;
  selectedProvider: string;
  selectedModel: string;
  streamContent: string;
  isStreaming: boolean;
  streamError: string | null;
  generationResult: string;
  isGenerating: boolean;
  lastGeneratedPost: GeneratedPost | null;
  opId: string | null;
  lastPostRequest: Partial<GeneratePostDto> | null;
  lastDigestRequest: Partial<GenerateDigestDto> | null;
  historyCursor: string | undefined;
  error: string | null;
}

interface GenerationActions {
  setGenerationType: (type: GenerationType) => void;
  setSelectedArticleIds: (ids: string[]) => void;
  setSelectedArticles: (articles: Article[]) => void;
  toggleSelectedArticle: (article: Article) => void;
  clearSelectedArticles: () => void;
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
  selectedArticleSnapshots: [],
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
  lastPostRequest: null,
  lastDigestRequest: null,
  historyCursor: undefined,
  error: null,
};

type DigestRequestState = Pick<
  GenerationState,
  | 'selectedArticleIds'
  | 'selectedAgentId'
  | 'selectedPeriod'
  | 'selectedTemplateId'
  | 'selectedProvider'
  | 'selectedModel'
  | 'lastDigestRequest'
>;

export function buildGenerateDigestRequest(
  state: DigestRequestState,
  dto?: Partial<GenerateDigestDto>
): GenerateDigestDto {
  const articleIds =
    dto?.article_ids
    ?? (state.selectedArticleIds.length > 0 ? state.selectedArticleIds : state.lastDigestRequest?.article_ids);
  const agentId = dto?.agent_id ?? state.selectedAgentId ?? state.lastDigestRequest?.agent_id ?? undefined;
  const articleCount = dto?.article_count ?? state.lastDigestRequest?.article_count;
  const period = dto?.period ?? state.selectedPeriod ?? state.lastDigestRequest?.period ?? 'day';
  const templateId = dto?.template_id ?? state.selectedTemplateId ?? state.lastDigestRequest?.template_id ?? undefined;
  const provider = dto?.provider ?? state.selectedProvider ?? state.lastDigestRequest?.provider;
  const model = dto?.model ?? state.selectedModel ?? state.lastDigestRequest?.model;

  return {
    ...(agentId ? { agent_id: agentId } : {}),
    ...(articleIds && articleIds.length > 0 ? { article_ids: articleIds } : {}),
    ...(articleCount !== undefined ? { article_count: articleCount } : {}),
    period,
    ...(templateId ? { template_id: templateId } : {}),
    ...(dto?.custom_prompt ? { custom_prompt: dto.custom_prompt } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  };
}

export const useGenerationStore = create<GenerationState & GenerationActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setGenerationType: (type) => set({ generationType: type }),
      setSelectedArticleIds: (ids) => set({ selectedArticleIds: ids }),
      setSelectedArticles: (articles) => set({
        selectedArticleIds: articles.map((article) => article.id),
        selectedArticleSnapshots: articles,
      }),
      toggleSelectedArticle: (article) => set((state) => {
        const isSelected = state.selectedArticleIds.includes(article.id);
        if (isSelected) {
          return {
            selectedArticleIds: state.selectedArticleIds.filter((id) => id !== article.id),
            selectedArticleSnapshots: state.selectedArticleSnapshots.filter((item) => item.id !== article.id),
          };
        }

        return {
          selectedArticleIds: [...state.selectedArticleIds, article.id],
          selectedArticleSnapshots: [
            ...state.selectedArticleSnapshots.filter((item) => item.id !== article.id),
            article,
          ],
        };
      }),
      clearSelectedArticles: () => set({ selectedArticleIds: [], selectedArticleSnapshots: [] }),
      setSelectedAgentId: (id) => set({ selectedAgentId: id }),
      setSelectedPeriod: (period) => set({ selectedPeriod: period }),
      setSelectedTemplateId: (id) => set({ selectedTemplateId: id }),
      setSelectedProvider: (provider) => set({ selectedProvider: provider }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      initFromProvider: (provider, model) => set({ selectedProvider: provider, selectedModel: model }),

      generatePost: async (dto) => {
        const state = get();
        const articleIds =
          dto?.article_ids
          ?? (state.selectedArticleIds.length > 0 ? state.selectedArticleIds : state.lastPostRequest?.article_ids)
          ?? [];
        const templateId = dto?.template_id ?? state.selectedTemplateId ?? state.lastPostRequest?.template_id ?? undefined;
        const provider = dto?.provider ?? state.selectedProvider ?? state.lastPostRequest?.provider;
        const model = dto?.model ?? state.selectedModel ?? state.lastPostRequest?.model;
        const request: GeneratePostDto = {
          article_ids: articleIds,
          template_id: templateId,
          custom_prompt: dto?.custom_prompt,
          provider,
          model,
        };

        set({ isGenerating: true, error: null, streamContent: '', generationResult: '', opId: null });
        try {
          const result = await generationApi.generatePost(request);
          set({
            opId: result.op_id,
            isGenerating: false,
            lastPostRequest: {
              article_ids: articleIds,
              template_id: templateId,
              provider,
              model,
            },
          });
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
        const request = buildGenerateDigestRequest(state, dto);

        set({ isGenerating: true, error: null, streamContent: '', generationResult: '', opId: null });
        try {
          const result = await generationApi.generateDigest(request);
          set({
            opId: result.op_id,
            isGenerating: false,
            lastDigestRequest: {
              agent_id: request.agent_id,
              article_ids: request.article_ids,
              article_count: request.article_count,
              period: request.period,
              template_id: request.template_id,
              provider: request.provider,
              model: request.model,
            },
          });
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
      partialize: (state) => ({
        selectedProvider: state.selectedProvider,
        selectedModel: state.selectedModel,
      }),
    }
  )
);
