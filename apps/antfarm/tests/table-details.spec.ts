import { test as base, expect } from "@playwright/test";
import {
  createTestTable,
  deleteTestTable,
  TEST_TABLE,
  TestTableConfig,
} from "./fixtures/test-data";

// Extend test to include automatic test table setup/teardown per test
// Each test gets a unique table name to allow parallel execution
const test = base.extend<{ testTable: TestTableConfig }>({
  testTable: async (_deps, use, testInfo) => {
    // Generate unique table name for this test run
    const uniqueName = `e2e_test_${testInfo.workerIndex}_${Date.now()}`;
    const config: TestTableConfig = {
      ...TEST_TABLE,
      name: uniqueName,
    };

    // Setup: create test table
    await createTestTable(config);
    console.log(`[fixture] Created test table: ${uniqueName}`);

    // Use the table in the test
    await use(config);

    // Teardown: delete test table
    await deleteTestTable(uniqueName).catch(() => undefined);
    console.log(`[fixture] Deleted test table: ${uniqueName}`);
  },
});

test.describe("Table Details Page", () => {
  test("can view table in tables list", async ({ page, testTable }) => {
    await page.goto("/tables");

    // Wait for the tables page to load
    await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();

    // Refresh to ensure we see the newly created table
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();

    // Should see our test table
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });
  });

  test("can navigate to table details", async ({ page, testTable }) => {
    await page.goto("/tables");

    // Click on the test table
    await page.getByRole("link", { name: testTable.name }).click();

    // Should be on table details page
    await expect(page).toHaveURL(new RegExp(`/tables/${testTable.name}`));

    // Should see table name in heading or breadcrumb
    await expect(page.getByText(testTable.name)).toBeVisible();
  });

  test("can view table schema section", async ({ page, testTable }) => {
    await page.goto(`/tables/${testTable.name}`);

    // Wait for page to load - check for table name first
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });

    // Click the Schema section in the sidebar
    await page.getByRole("button", { name: "Schema" }).click();

    // Should see the Table Schema section header
    await expect(page.getByRole("heading", { name: "Table Schema" })).toBeVisible({
      timeout: 10000,
    });

    // Should see schema content or field explorer
    // Since this is a fresh table, we should see the Field Explorer button
    await expect(page.getByRole("button", { name: "Explore Records" })).toBeVisible({
      timeout: 5000,
    });
  });

  test("can use Field Explorer to discover fields", async ({ page, testTable }) => {
    await page.goto(`/tables/${testTable.name}`);

    // Wait for page to load - check for table name first
    await expect(page.getByText(testTable.name)).toBeVisible({ timeout: 10000 });

    // Click the Schema section in the sidebar
    await page.getByRole("button", { name: "Schema" }).click();

    // Wait for the Table Schema section
    await expect(page.getByRole("heading", { name: "Table Schema" })).toBeVisible({
      timeout: 10000,
    });

    // Look for Explore Records button (shows when no schema)
    const exploreButton = page.getByRole("button", { name: "Explore Records" });

    if (await exploreButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await exploreButton.click();

      // Wait for field discovery
      await expect(page.getByText(/Found \d+ fields/)).toBeVisible({ timeout: 10000 });

      // Should see our document fields
      await expect(page.getByText("title")).toBeVisible();
      await expect(page.getByText("content")).toBeVisible();
      await expect(page.getByText("category")).toBeVisible();
    }
  });
});
