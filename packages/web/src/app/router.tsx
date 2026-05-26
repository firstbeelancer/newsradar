import { createRouter, createRoute, createRootRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@shared/stores/auth-store';
import { RootLayout } from './layout';
import { App } from './app';

// Lazy-loaded pages
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { LoginForm } from '@/features/auth/login-form';
import { RegisterForm } from '@/features/auth/register-form';
import { AgentsListPage } from '@/features/agents/agents-list-page';
import { AgentDetailPage } from '@/features/agents/agent-detail-page';
import { SourcesPage } from '@/features/sources/sources-page';
import { FeedPage } from '@/features/feed/feed-page';
import { ArticleDetail } from '@/features/feed/article-detail';
import { GenerationPage } from '@/features/generation/generation-page';
import { GeneratedPostsPage } from '@/features/generation/generated-posts-page';
import { HistoryPage } from '@/features/history/history-page';
import { SettingsLayout } from '@/features/settings/settings-layout';
import { ProfileSettings } from '@/features/settings/profile-settings';
import { AgentsSettings } from '@/features/settings/agents-settings';
import { TemplatesSettings } from '@/features/settings/templates-settings';
import { AIProvidersSettings } from '@/features/settings/ai-providers-settings';
import { PromptsSettings } from '@/features/settings/prompts-settings';
import { TelegramAssetsSettings } from '@/features/settings/telegram-assets-settings';
import { DeepSearchSettings } from '@/features/settings/deepsearch-settings';
import { SubscriptionPage } from '@/features/subscriptions/subscription-page';
import { IBoardPage } from '@/features/iboard/iboard-page';
import { NotificationsPage } from '@/features/notifications/notifications-page';

function hasValidAuthState() {
  const state = useAuthStore.getState();
  return Boolean(state.isAuthenticated && state.access_token);
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'app',
  component: App,
  beforeLoad: () => {
    if (!hasValidAuthState()) {
      throw redirect({ to: '/login' });
    }
  },
});

// ─── Main Routes ─────────────────────────────────────────────────────────────

const indexRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/',
  component: DashboardPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginForm,
  beforeLoad: () => {
    if (hasValidAuthState()) {
      throw redirect({ to: '/' });
    }
  },
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  component: RegisterForm,
  beforeLoad: () => {
    if (hasValidAuthState()) {
      throw redirect({ to: '/' });
    }
  },
});

// ─── Agents ──────────────────────────────────────────────────────────────────

const agentsListRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/agents',
  component: AgentsListPage,
});

const agentNewRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/agents/new',
  component: AgentsListPage,
});

const agentDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/agents/$id',
  component: AgentDetailRouteComponent,
});

function AgentDetailRouteComponent() {
  const { id } = agentDetailRoute.useParams();
  return <AgentDetailPage agentId={id} />;
}

// ─── Sources ─────────────────────────────────────────────────────────────────

const sourcesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/sources',
  component: SourcesPage,
});

// ─── Feed ────────────────────────────────────────────────────────────────────

const feedRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/feed',
  component: FeedPage,
});

const feedByAgentRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/feed/$agentId',
  component: FeedPage,
});

const articleDetailRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/feed/article/$id',
  component: ArticleDetailRouteComponent,
});

function ArticleDetailRouteComponent() {
  const { id } = articleDetailRoute.useParams();
  return <ArticleDetail articleId={id} />;
}

// ─── Search ──────────────────────────────────────────────────────────────────

const searchRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/search',
  component: FeedPage,
});

// ─── Generation ──────────────────────────────────────────────────────────────

const generationRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/generation',
  component: GenerationPage,
});

const generatedPostsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/generated',
  component: GeneratedPostsPage,
});

const historyRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/history',
  component: HistoryPage,
});

// ─── Subscription ────────────────────────────────────────────────────────────

const subscriptionRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/subscription',
  component: SubscriptionPage,
});

// ─── iBoard ──────────────────────────────────────────────────────────────────

const iboardRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/iboard',
  component: IBoardPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/analytics',
  component: IBoardPage,
});

// ─── Notifications ───────────────────────────────────────────────────────────

const notificationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/notifications',
  component: NotificationsPage,
});

// ─── Settings ────────────────────────────────────────────────────────────────

const settingsLayoutRoute = createRoute({
  getParentRoute: () => appRoute,
  path: '/settings',
  component: SettingsLayout,
});

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile' });
  },
});

const settingsProfileRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'profile',
  component: ProfileSettings,
});

const settingsAgentsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'agents',
  component: AgentsSettings,
});

const settingsTemplatesRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'templates',
  component: TemplatesSettings,
});

const settingsAIProvidersRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'ai-providers',
  component: AIProvidersSettings,
});

const settingsPromptsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'prompts',
  component: PromptsSettings,
});

const settingsTelegramAssetsRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'telegram-assets',
  component: TelegramAssetsSettings,
});

const settingsDeepSearchRoute = createRoute({
  getParentRoute: () => settingsLayoutRoute,
  path: 'deepsearch',
  component: DeepSearchSettings,
});

// ─── Route Tree ──────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  appRoute.addChildren([
    indexRoute,
    agentsListRoute,
    agentNewRoute,
    agentDetailRoute,
    sourcesRoute,
    feedRoute,
    feedByAgentRoute,
    articleDetailRoute,
    searchRoute,
    generationRoute,
    generatedPostsRoute,
    historyRoute,
    subscriptionRoute,
    iboardRoute,
    analyticsRoute,
    notificationsRoute,
    settingsLayoutRoute.addChildren([
      settingsIndexRoute,
      settingsProfileRoute,
      settingsAgentsRoute,
      settingsTemplatesRoute,
      settingsAIProvidersRoute,
      settingsPromptsRoute,
      settingsTelegramAssetsRoute,
      settingsDeepSearchRoute,
    ]),
  ]),
  loginRoute,
  registerRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register types
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
