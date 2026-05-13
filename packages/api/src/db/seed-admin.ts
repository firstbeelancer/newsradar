import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "./index.js";
import { users, workspaces, aiProviders } from "./schema.js";
import { encrypt } from "../lib/encryption.js";

const SALT_ROUNDS = 12;

interface SeedUser {
  email: string;
  password: string;
  name: string;
}

const SEED_USERS: SeedUser[] = [
  {
    email: "firstbeelancer@gmail.com",
    password: "firstbeelancer",
    name: "firstbeelancer",
  },
];

// AI providers to seed (only created if they don't exist for the workspace)
// API key is read from PLATFORM_AI_API_KEY env var at runtime
const SEED_AI_PROVIDERS = [
  {
    name: "OpenRouter Owl Alpha",
    type: "byok" as const,
    provider: "openrouter" as const,
    baseUrl: "https://openrouter.ai/api/v1",
    apiKeyEnvVar: "PLATFORM_AI_API_KEY",
    model: "openrouter/owl-alpha",
  },
];

/**
 * Ensures that seed users exist in the database with correct passwords.
 * Also seeds default AI providers for the user's workspace.
 * Runs on every API startup — safe to call repeatedly (idempotent).
 */
export async function seedAdminUsers(): Promise<void> {
  for (const seed of SEED_USERS) {
    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.email, seed.email),
      });

      let workspaceId: string | undefined;

      if (!existing) {
        // Create user + workspace
        const passwordHash = await bcrypt.hash(seed.password, SALT_ROUNDS);
        const [user] = await db
          .insert(users)
          .values({
            email: seed.email,
            passwordHash,
            name: seed.name,
          })
          .returning();

        // Ensure workspace exists
        const existingWorkspace = await db.query.workspaces.findFirst({
          where: eq(workspaces.userId, user.id),
        });

        if (!existingWorkspace) {
          const [ws] = await db.insert(workspaces).values({
            userId: user.id,
            name: `${seed.name} workspace`,
            plan: "free",
          }).returning();
          workspaceId = ws.id;
        } else {
          workspaceId = existingWorkspace.id;
        }

        console.log(`[seed] Created admin user: ${seed.email}`);
      } else {
        // Verify password matches
        const valid = await bcrypt.compare(seed.password, existing.passwordHash ?? "");
        if (!valid) {
          const passwordHash = await bcrypt.hash(seed.password, SALT_ROUNDS);
          await db
            .update(users)
            .set({ passwordHash, name: seed.name })
            .where(eq(users.email, seed.email));
          console.log(`[seed] Updated password for: ${seed.email}`);
        } else {
          console.log(`[seed] Admin user OK: ${seed.email}`);
        }

        // Get workspace ID
        const ws = await db.query.workspaces.findFirst({
          where: eq(workspaces.userId, existing.id),
        });
        workspaceId = ws?.id;
      }

      // Seed AI providers for this workspace
      if (workspaceId) {
        await seedAIProviders(workspaceId);
      }
    } catch (err) {
      console.error(`[seed] Error seeding user ${seed.email}:`, err);
    }
  }
}

async function seedAIProviders(workspaceId: string): Promise<void> {
  for (const provider of SEED_AI_PROVIDERS) {
    try {
      // Read API key from environment variable
      const apiKeyPlain = process.env[provider.apiKeyEnvVar];
      if (!apiKeyPlain) {
        console.log(`[seed] Skipping AI provider ${provider.name}: env var ${provider.apiKeyEnvVar} not set`);
        continue;
      }

      // Check if provider already exists for this workspace
      const existing = await db.query.aiProviders.findFirst({
        where: and(
          eq(aiProviders.workspaceId, workspaceId),
          eq(aiProviders.provider, provider.provider),
          eq(aiProviders.model, provider.model),
        ),
      });

      if (!existing) {
        await db.insert(aiProviders).values({
          name: provider.name,
          type: provider.type,
          provider: provider.provider,
          baseUrl: provider.baseUrl,
          apiKeyEncrypted: encrypt(apiKeyPlain),
          model: provider.model,
          isActive: true,
          workspaceId,
        });
        console.log(`[seed] Created AI provider: ${provider.name}`);
      } else {
        console.log(`[seed] AI provider already exists: ${provider.name}`);
      }
    } catch (err) {
      console.error(`[seed] Error seeding AI provider ${provider.name}:`, err);
    }
  }
}
