import { test as base, expect } from "@playwright/test";
import {
  createTestTable,
  deleteTestTable,
  TEST_TABLE,
  type TestTableConfig,
} from "./fixtures/test-data";

// Test with embedding index for semantic search
const test = base.extend<{ testTable: TestTableConfig }>({
  testTable: async (_deps, use, testInfo) => {
    const uniqueName = `e2e_search_${testInfo.workerIndex}_${Date.now()}`;
    const config: TestTableConfig = {
      ...TEST_TABLE,
      name: uniqueName,
      withEmbeddingIndex: true,
    };

    await createTestTable(config);
    await use(config);
    await deleteTestTable(uniqueName).catch(() => undefined);
  },
});

/**
 * Helper to enable semantic search toggle.
 * The switch is inside the "Semantic Search" accordion trigger.
 */
async function enableSemanticSearch(page: import("@playwright/test").Page) {
  // Find the Semantic Search button (accordion trigger) and its switch
  const semanticSwitch = page.getByRole("button", { name: "Semantic Search" }).getByRole("switch");
  await semanticSwitch.click();
}

test.describe("Search Page - Semantic Search Defaults", () => {
  test("auto-selects first vector index when semantic search enabled", async ({
    page,
    testTable,
  }) => {
    await page.goto(`/tables/${testTable.name}`);
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });

    // Go to Search section
    await page.getByRole("button", { name: "Search" }).click();

    // Wait for Search section to load
    await expect(page.getByText("Semantic Search")).toBeVisible({ timeout: 5000 });

    // Enable semantic search
    await enableSemanticSearch(page);

    // Should auto-select the "embeddings" index
    await expect(page.getByText("embeddings")).toBeVisible({ timeout: 5000 });

    // Should show helper text about defaults
    await expect(page.getByText(/First index auto-selected/)).toBeVisible();
  });

  test("can run semantic search with auto-selected defaults", async ({ page, testTable }) => {
    await page.goto(`/tables/${testTable.name}`);
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Semantic Search")).toBeVisible({ timeout: 5000 });

    // Enable semantic search
    await enableSemanticSearch(page);

    // Wait for auto-selection
    await expect(page.getByText("embeddings")).toBeVisible({ timeout: 5000 });

    // Enter query and run - use the input inside semantic search section
    await page.getByPlaceholder("Enter search query...").fill("test document");
    await page.getByRole("button", { name: "Run Query" }).click();

    // Should get results
    await expect(page.getByText(/\d+ hits?/)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Search Results Display", () => {
  test("displays score without stars", async ({ page, testTable }) => {
    await page.goto(`/tables/${testTable.name}`);
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Semantic Search")).toBeVisible({ timeout: 5000 });

    // Run a semantic search
    await enableSemanticSearch(page);
    await expect(page.getByText("embeddings")).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder("Enter search query...").fill("test");
    await page.getByRole("button", { name: "Run Query" }).click();

    // Wait for results
    await expect(page.getByText(/\d+ hits?/)).toBeVisible({ timeout: 15000 });

    // Should show "Score:" label, not star icons
    await expect(page.getByText("Score:").first()).toBeVisible();

    // Should NOT have yellow filled stars
    const stars = page.locator('[class*="fill-yellow-400"]');
    await expect(stars).toHaveCount(0);
  });

  test("displays query time in human-readable format", async ({ page, testTable }) => {
    await page.goto(`/tables/${testTable.name}`);
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Semantic Search")).toBeVisible({ timeout: 5000 });

    // Run a semantic search
    await enableSemanticSearch(page);
    await expect(page.getByText("embeddings")).toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder("Enter search query...").fill("test");
    await page.getByRole("button", { name: "Run Query" }).click();

    // Wait for results
    await expect(page.getByText(/\d+ hits?/)).toBeVisible({ timeout: 15000 });

    // Timing should be reasonable (ms or s format, not millions of ms)
    // Look for timing badge with format like "5ms", "123ms", "< 1ms", or "1.2s"
    await expect(page.locator("text=/^(< 1ms|\\d+ms|\\d+\\.\\d+s)$/")).toBeVisible();
  });
});

test.describe("RAG Playground", () => {
  // This test doesn't need a table fixture
  test.use({ testTable: undefined as unknown as TestTableConfig });

  test("Load Sample button is removed", async ({ page }) => {
    await page.goto("/playground/rag");

    // Wait for page to load - look for the main heading
    await expect(page.getByRole("heading", { name: "RAG Playground" })).toBeVisible({
      timeout: 10000,
    });

    // "Load Sample" button should NOT exist
    await expect(page.getByRole("button", { name: "Load Sample" })).toHaveCount(0);

    // Reset button should still exist
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  });
});
