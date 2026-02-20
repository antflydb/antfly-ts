/**
 * Semantic search for the command palette.
 * Uses an Antfly table with an aknn_v0 index for vector search.
 */

import type { AntflyClient, EmbedderConfig } from "@antfly/sdk";

export interface CommandItem {
  id: string;
  type: "navigation" | "action";
  label: string;
  description: string;
  href?: string;
  action?: string;
  icon: string;
}

export interface SemanticResult {
  item: CommandItem;
  score: number;
}

const TABLE_NAME = "_antfarm_commands";
const INDEX_NAME = "semantic";

// Command palette items - keep in sync with command-palette-provider.tsx
const COMMANDS: CommandItem[] = [
  // Navigation
  {
    id: "nav-tables",
    type: "navigation",
    label: "Tables",
    description: "View and manage database tables",
    href: "/",
    icon: "Table",
  },
  {
    id: "nav-create",
    type: "navigation",
    label: "Create Table",
    description: "Create a new database table with indexes",
    href: "/create",
    icon: "Plus",
  },
  {
    id: "nav-models",
    type: "navigation",
    label: "Models",
    description: "View available ML models for embedding and inference",
    href: "/models",
    icon: "Library",
  },
  {
    id: "nav-users",
    type: "navigation",
    label: "Users",
    description: "Manage users and permissions",
    href: "/users",
    icon: "Users",
  },

  // Playgrounds
  {
    id: "play-chunking",
    type: "navigation",
    label: "Chunking Playground",
    description: "Test document chunking strategies for RAG",
    href: "/playground/chunking",
    icon: "Scissors",
  },
  {
    id: "play-ner",
    type: "navigation",
    label: "NER Playground",
    description: "Named entity recognition and extraction",
    href: "/playground/recognize",
    icon: "Tag",
  },
  {
    id: "play-question",
    type: "navigation",
    label: "Question Gen",
    description: "Generate questions from documents for evaluation",
    href: "/playground/question",
    icon: "HelpCircle",
  },
  {
    id: "play-kg",
    type: "navigation",
    label: "Knowledge Graph",
    description: "Build and visualize knowledge graphs",
    href: "/playground/kg",
    icon: "Network",
  },
  {
    id: "play-evals",
    type: "navigation",
    label: "Evals",
    description: "Run RAG evaluations and benchmarks",
    href: "/playground/evals",
    icon: "ClipboardCheck",
  },
  {
    id: "play-rag",
    type: "navigation",
    label: "RAG Playground",
    description: "Test retrieval-augmented generation pipelines",
    href: "/playground/rag",
    icon: "MessageSquare",
  },

  // Quick actions
  {
    id: "action-theme",
    type: "action",
    label: "Toggle Theme",
    description: "Switch between light and dark mode",
    action: "toggle-theme",
    icon: "Moon",
  },
  {
    id: "action-width",
    type: "action",
    label: "Toggle Content Width",
    description: "Expand or restrict content width",
    action: "toggle-width",
    icon: "Maximize2",
  },
];

let initPromise: Promise<void> | null = null;

/**
 * Ensures the _antfarm_commands table exists with the semantic index.
 * Creates and seeds the table if it doesn't exist.
 */
async function ensureInitialized(client: AntflyClient): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check if table exists AND has indexed data
      const indexStatus = await client.indexes.get(TABLE_NAME, INDEX_NAME);
      const status = indexStatus?.status as { total_indexed?: number } | undefined;
      if (status?.total_indexed && status.total_indexed >= COMMANDS.length) {
        return; // Table is ready
      }
      // Table/index exists but not fully populated - drop and recreate
      await client.tables.drop(TABLE_NAME);
    } catch {
      // Table or index doesn't exist, create it
    }

    // Create the table with schema
    await client.tables.create(TABLE_NAME, {
      num_shards: 1,
      schema: {
        version: 0,
        default_type: "command",
        document_schemas: {
          command: {
            schema: {
              type: "object",
              "x-antfly-include-in-all": ["label", "description"],
              properties: {
                id: { type: "string", "x-antfly-types": ["keyword"] },
                type: { type: "string", "x-antfly-types": ["keyword"] },
                label: { type: "string", "x-antfly-types": ["text", "keyword"] },
                description: { type: "string", "x-antfly-types": ["text"] },
                href: { type: "string", "x-antfly-types": ["keyword"] },
                action: { type: "string", "x-antfly-types": ["keyword"] },
                icon: { type: "string", "x-antfly-types": ["keyword"] },
              },
            },
          },
        },
      },
    });

    // Create the semantic search index
    // Note: Type assertion needed because AntflyEmbedderConfig is Record<string, never>
    // in the SDK types, but we need to pass { provider: "antfly" }
    const embedder = { provider: "antfly" } as unknown as EmbedderConfig;
    await client.indexes.create(TABLE_NAME, {
      name: INDEX_NAME,
      type: "aknn_v0",
      template: "{{label}}. {{description}}",
      embedder,
      dimension: 384,
    });

    // Seed the data
    const inserts: Record<string, CommandItem> = {};
    for (const cmd of COMMANDS) {
      inserts[cmd.id] = cmd;
    }
    await client.tables.batch(TABLE_NAME, { inserts });

    // Give the index enricher time to compute embeddings
    // 12 items with built-in MiniLM should be quick, but async processing needs a moment
    await new Promise((resolve) => setTimeout(resolve, 1000));
  })();

  initPromise.catch(() => {
    initPromise = null;
  });

  return initPromise;
}

/**
 * Triggers initialization of the command palette table.
 * Call this early (e.g., on page load) to give embeddings time to compute.
 */
export function initCommandPaletteSearch(client: AntflyClient): void {
  ensureInitialized(client).catch(() => {
    // Ignore errors - will retry on actual search
  });
}

/**
 * Performs semantic search against the command palette items.
 * Uses Antfly's vector search to find semantically similar commands.
 *
 * @param query - The user's search query
 * @param client - AntflyClient instance
 * @param limit - Maximum number of results to return (default: 3)
 * @returns Promise resolving to semantic search results sorted by score
 */
export async function semanticSearch(
  query: string,
  client: AntflyClient,
  limit = 3
): Promise<SemanticResult[]> {
  try {
    await ensureInitialized(client);

    const result = await client.tables.query(TABLE_NAME, {
      semantic_search: query,
      indexes: [INDEX_NAME],
      limit,
    });

    // Extract hits from the response
    const hits = result?.responses?.[0]?.hits?.hits ?? [];

    return hits.map((hit) => ({
      item: hit._source as unknown as CommandItem,
      score: hit._score ?? 0,
    }));
  } catch (e) {
    console.error("Semantic search failed:", e);
    return [];
  }
}

/**
 * Gets all command items (for reference/debugging).
 */
export function getAllCommandItems(): CommandItem[] {
  return COMMANDS;
}
