import { create } from 'zustand';
import { subscriptionApi, type Subscription, type SubscriptionLimits, type Payment } from '@shared/api/client';

interface SubscriptionState {
  subscription: Subscription | null;
  limits: SubscriptionLimits | null;
  payments: Payment[];
  isLoading: boolean;
  isCreating: boolean;
  isCanceling: boolean;
  error: string | null;
}

interface SubscriptionActions {
  fetchSubscription: () => Promise<void>;
  fetchLimits: () => Promise<void>;
  fetchPayments: () => Promise<void>;
  createPayment: () => Promise<string>;
  cancelSubscription: () => Promise<void>;
  clearError: () => void;
}

const initialState: SubscriptionState = {
  subscription: null,
  limits: null,
  payments: [],
  isLoading: false,
  isCreating: false,
  isCanceling: false,
  error: null,
};

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>((set) => ({
  ...initialState,

  fetchSubscription: async () => {
    set({ isLoading: true, error: null });
    try {
      const subscription = await subscriptionApi.get();
      set({ subscription, isLoading: false });
    } catch {
      set({ subscription: { plan: 'free', status: 'active', current_period_start: '', current_period_end: '', cancel_at_period_end: false }, isLoading: false });
    }
  },

  fetchLimits: async () => {
    set({ isLoading: true, error: null });
    try {
      const limits = await subscriptionApi.getLimits();
      set({ limits, isLoading: false });
    } catch {
      set({
        limits: {
          favorites_used: 0, favorites_limit: 100,
          collections_used: 0, collections_limit: 30,
          agents_used: 0, agents_limit: 5,
          sources_used: 0, sources_limit: 20,
          generation_used: 0, generation_limit: 50,
        },
        isLoading: false,
      });
    }
  },

  fetchPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const payments = await subscriptionApi.getPayments();
      set({ payments, isLoading: false });
    } catch {
      set({ payments: [], isLoading: false });
    }
  },

  createPayment: async () => {
    set({ isCreating: true, error: null });
    try {
      const response = await subscriptionApi.create();
      set({ isCreating: false });
      return response.confirmation_url;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка создания платежа',
        isCreating: false,
      });
      throw err;
    }
  },

  cancelSubscription: async () => {
    set({ isCanceling: true, error: null });
    try {
      await subscriptionApi.cancel();
      const subscription = await subscriptionApi.get();
      set({ subscription, isCanceling: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Ошибка отмены подписки',
        isCanceling: false,
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
