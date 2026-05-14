import { eq, and } from "drizzle-orm";
import { db } from "./index.js";
import { agents, sources, agentSources, workspaces } from "./schema.js";

// ─── Sources from TigerWiki TZ Appendix ───
// These are mapped by subjectArea to EXISTING agents.
// The seed does NOT create new agents — it only adds sources
// to agents that already exist for each workspace.

interface SeedSource {
  name: string;
  type: "rss" | "telegram";
  url: string;
  isActive: boolean; // false = disabled by default (priority 3 / "recommended")
}

const SOURCES_BY_SUBJECT_AREA: Record<string, SeedSource[]> = {
  cybersec: [
    { name: "Хабр — Информационная безопасность", type: "rss", url: "https://habr.com/ru/rss/hubs/infosecurity/articles/?fl=ru", isActive: true },
    { name: "SecurityLab", type: "rss", url: "https://www.securitylab.ru/_Services/Export/RSS/", isActive: true },
    { name: "Kaspersky Daily RU", type: "rss", url: "https://www.kaspersky.ru/blog/feed/", isActive: true },
    { name: "The Hacker News", type: "rss", url: "https://feeds.feedburner.com/TheHackersNews", isActive: true },
    { name: "BleepingComputer", type: "rss", url: "https://www.bleepingcomputer.com/feed/", isActive: true },
    { name: "CISA Cybersecurity Advisories", type: "rss", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml", isActive: true },
    { name: "CVE Daily — Critical", type: "rss", url: "https://cvedaily.com/feed-critical.xml", isActive: false },
    { name: "Positive Technologies (Telegram)", type: "telegram", url: "https://t.me/Positive_Technologies", isActive: true },
    { name: "Kaspersky Daily (Telegram)", type: "telegram", url: "https://t.me/KasperskyDaily", isActive: true },
    { name: "The Hacker News (Telegram)", type: "telegram", url: "https://t.me/thehackernews", isActive: false },
  ],
  ai: [
    { name: "Хабр — Искусственный интеллект", type: "rss", url: "https://habr.com/ru/rss/hubs/artificial_intelligence/articles/?fl=ru", isActive: true },
    { name: "Hugging Face Blog", type: "rss", url: "https://huggingface.co/blog/feed.xml", isActive: true },
    { name: "arXiv cs.AI", type: "rss", url: "https://export.arxiv.org/rss/cs.AI", isActive: true },
    { name: "arXiv cs.CL", type: "rss", url: "https://export.arxiv.org/rss/cs.CL", isActive: true },
    { name: "MIT Technology Review — AI", type: "rss", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", isActive: true },
    { name: "VentureBeat AI", type: "rss", url: "https://venturebeat.com/category/ai/feed/", isActive: true },
    { name: "Hacker News — AI search feed", type: "rss", url: "https://hnrss.org/newest?q=AI%20OR%20LLM%20OR%20OpenAI%20OR%20Claude%20OR%20Gemini", isActive: false },
    { name: "Хабр (Telegram)", type: "telegram", url: "https://t.me/habr_com", isActive: false },
    { name: "OpenAI (Telegram)", type: "telegram", url: "https://t.me/openai", isActive: false },
  ],
  marketing: [
    { name: "Cossa", type: "rss", url: "https://www.cossa.ru/rss/", isActive: true },
    { name: "vc.ru — Маркетинг", type: "rss", url: "https://vc.ru/rss", isActive: false },
    { name: "Search Engine Land", type: "rss", url: "https://searchengineland.com/feed", isActive: true },
    { name: "HubSpot Marketing Blog", type: "rss", url: "https://blog.hubspot.com/marketing/rss.xml", isActive: true },
    { name: "Social Media Examiner", type: "rss", url: "https://www.socialmediaexaminer.com/feed/", isActive: true },
    { name: "MarketingProfs", type: "rss", url: "https://www.marketingprofs.com/rss/all", isActive: false },
    { name: "vc.ru (Telegram)", type: "telegram", url: "https://t.me/vcru", isActive: true },
    { name: "Cossa (Telegram)", type: "telegram", url: "https://t.me/cossa_ru", isActive: true },
  ],
  medical: [
    { name: "WHO News", type: "rss", url: "https://www.who.int/rss-feeds/news-english.xml", isActive: true },
    { name: "NIH News Releases", type: "rss", url: "https://www.nih.gov/news-events/news-releases/feed.xml", isActive: true },
    { name: "ScienceDaily — Health & Medicine", type: "rss", url: "https://www.sciencedaily.com/rss/health_medicine.xml", isActive: true },
    { name: "Medical Xpress — Medicine News", type: "rss", url: "https://medicalxpress.com/rss-feed/medicine-news/", isActive: true },
    { name: "Medscape", type: "rss", url: "https://www.medscape.com/rss", isActive: false },
  ],
  design: [
    { name: "Smashing Magazine", type: "rss", url: "https://www.smashingmagazine.com/feed/", isActive: true },
    { name: "UX Collective", type: "rss", url: "https://uxdesign.cc/feed", isActive: true },
    { name: "Creative Bloq", type: "rss", url: "https://www.creativebloq.com/feeds.xml", isActive: true },
    { name: "AIGA Eye on Design", type: "rss", url: "https://eyeondesign.aiga.org/feed/", isActive: true },
    { name: "Design Milk", type: "rss", url: "https://design-milk.com/feed/", isActive: false },
    { name: "Хабр — Дизайн", type: "rss", url: "https://habr.com/ru/rss/hubs/design/articles/?fl=ru", isActive: true },
    { name: "Awdee (Telegram)", type: "telegram", url: "https://t.me/awdee", isActive: true },
  ],
};

/**
 * Seeds default sources for existing agents.
 * Finds agents by their subjectArea and adds the appropriate sources.
 * Idempotent — checks if sources already exist by URL before creating.
 * Runs on every API startup after seedAdminUsers.
 */
export async function seedDefaultSources(): Promise<void> {
  try {
    const allWorkspaces = await db.query.workspaces.findMany();

    for (const workspace of allWorkspaces) {
      await seedForWorkspace(workspace.id);
    }
  } catch (err) {
    console.error("[seed-sources] Error seeding default sources:", err);
  }
}

async function seedForWorkspace(workspaceId: string): Promise<void> {
  // Find all existing agents for this workspace
  const existingAgents = await db.query.agents.findMany({
    where: eq(agents.workspaceId, workspaceId),
  });

  if (existingAgents.length === 0) {
    console.log(`[seed-sources] No agents found for workspace ${workspaceId}, skipping`);
    return;
  }

  for (const agent of existingAgents) {
    const subjectArea = agent.subjectArea;
    if (!subjectArea) {
      console.log(`[seed-sources] Agent "${agent.name}" has no subjectArea, skipping`);
      continue;
    }

    const seedSources = SOURCES_BY_SUBJECT_AREA[subjectArea];
    if (!seedSources) {
      console.log(`[seed-sources] No sources configured for subjectArea "${subjectArea}", skipping`);
      continue;
    }

    console.log(`[seed-sources] Adding ${seedSources.length} sources to existing agent "${agent.name}" (${subjectArea})`);

    for (const seedSource of seedSources) {
      try {
        // Check if source with this URL already exists for this workspace
        const existingSource = await db.query.sources.findFirst({
          where: and(
            eq(sources.workspaceId, workspaceId),
            eq(sources.url, seedSource.url),
          ),
        });

        let sourceId: string;

        if (!existingSource) {
          // Create the source
          const sourceValues: {
            name: string;
            type: string;
            url: string;
            channelUsername: string | null;
            isActive: boolean;
            workspaceId: string;
          } = {
            name: seedSource.name,
            type: seedSource.type,
            url: seedSource.url,
            channelUsername: seedSource.type === "telegram"
              ? seedSource.url.replace("https://t.me/", "")
              : null,
            isActive: seedSource.isActive,
            workspaceId,
          };

          const [newSource] = await db
            .insert(sources)
            .values(sourceValues)
            .returning();

          sourceId = newSource.id;
          console.log(`[seed-sources] Created source: ${seedSource.name}`);
        } else {
          sourceId = existingSource.id;
        }

        // Link agent to source (idempotent via onConflictDoNothing)
        await db
          .insert(agentSources)
          .values({
            agentId: agent.id,
            sourceId,
          })
          .onConflictDoNothing({
            target: [agentSources.agentId, agentSources.sourceId],
          });
      } catch (sourceErr) {
        console.error(`[seed-sources] Error seeding source ${seedSource.name}:`, sourceErr);
      }
    }
  }
}
