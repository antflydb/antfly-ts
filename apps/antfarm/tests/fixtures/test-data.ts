import { request } from "@playwright/test";

const API_URL = process.env.ANTFLY_API_URL || "http://localhost:8080";

export interface TestTableConfig {
  name: string;
  documents: Record<string, unknown>[];
  /** If true, create an embedding index for RAG testing */
  withEmbeddingIndex?: boolean;
}

/**
 * Create a test table with documents via the Antfly API
 */
export async function createTestTable(config: TestTableConfig): Promise<void> {
  const context = await request.newContext({ baseURL: API_URL });

  // Create table (POST /api/v1/tables/{tableName})
  const createRes = await context.post(`/api/v1/tables/${config.name}`, {
    data: {},
  });
  if (!createRes.ok()) {
    const body = await createRes.text();
    // "already exists" is fine
    if (!body.includes("already exists")) {
      throw new Error(`Failed to create table: ${body}`);
    }
  }

  // Wait for shards to initialize
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Create embedding index if requested
  if (config.withEmbeddingIndex) {
    const indexName = "embeddings";
    const indexRes = await context.post(`/api/v1/tables/${config.name}/indexes/${indexName}`, {
      data: {
        name: indexName,
        type: "aknn_v0",
        template: "{{title}} {{content}}",
        embedder: {
          provider: "termite",
          model: "BAAI/bge-small-en-v1.5",
        },
      },
    });
    if (!indexRes.ok()) {
      const body = await indexRes.text();
      if (!body.includes("already exists")) {
        throw new Error(`Failed to create embedding index: ${body}`);
      }
    }
    // Wait for index to initialize
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Insert documents via batch endpoint
  // Format: { inserts: { "doc_id": { ...doc }, ... } }
  if (config.documents.length > 0) {
    const inserts: Record<string, unknown> = {};
    config.documents.forEach((doc, i) => {
      const id = (doc as { id?: string }).id || `doc_${i}`;
      inserts[id] = doc;
    });

    const batchRes = await context.post(`/api/v1/tables/${config.name}/batch`, {
      data: { inserts },
    });
    if (!batchRes.ok()) {
      throw new Error(`Failed to insert documents: ${await batchRes.text()}`);
    }

    // Wait for embeddings to be generated if we have an embedding index
    // Embedding generation is async - need to wait for it to complete
    if (config.withEmbeddingIndex) {
      await new Promise((resolve) => setTimeout(resolve, 8000));
    }
  }

  await context.dispose();
}

/**
 * Delete a test table via the Antfly API
 */
export async function deleteTestTable(name: string): Promise<void> {
  const context = await request.newContext({ baseURL: API_URL });

  const res = await context.delete(`/api/v1/tables/${name}`);
  // "not found" is fine - table might not exist
  if (!res.ok()) {
    const body = await res.text();
    if (!body.includes("not found")) {
      throw new Error(`Failed to delete table: ${body}`);
    }
  }

  await context.dispose();
}

/**
 * Standard test table with sample documents
 */
export const TEST_TABLE: TestTableConfig = {
  name: "e2e_test_table",
  documents: [
    {
      id: "doc1",
      title: "Test Document One",
      content: "This is the first test document for e2e testing.",
      category: "testing",
      score: 42,
    },
    {
      id: "doc2",
      title: "Test Document Two",
      content: "This is the second test document with different content.",
      category: "example",
      score: 87,
    },
    {
      id: "doc3",
      title: "Another Test Doc",
      content: "Third document for comprehensive testing scenarios.",
      category: "testing",
      score: 15,
    },
  ],
};
