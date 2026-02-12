import { expect, test as base } from "@playwright/test";
import { createTestTable, deleteTestTable, TestTableConfig } from "./fixtures/test-data";

// Test table with documents that can be used for RAG evaluation
const EVAL_TEST_TABLE: TestTableConfig = {
  name: "e2e_eval_test",
  documents: [
    {
      id: "doc1",
      title: "France Geography",
      content: "Paris is the capital and largest city of France. It is located in the north-central part of the country along the Seine River.",
    },
    {
      id: "doc2",
      title: "Eiffel Tower History",
      content: "The Eiffel Tower was built between 1887 and 1889 as the entrance arch for the 1889 World's Fair. It was designed by Gustave Eiffel's engineering company.",
    },
    {
      id: "doc3",
      title: "French Culture",
      content: "France is known for its rich culture, including art, cuisine, and fashion. The Louvre Museum in Paris is one of the world's largest art museums.",
    },
  ],
};

// Extend test to include automatic test table setup/teardown
const test = base.extend<{ evalTestTable: TestTableConfig }>({
  evalTestTable: async ({}, use, testInfo) => {
    // Generate unique table name for this test run
    const uniqueName = `e2e_eval_${testInfo.workerIndex}_${Date.now()}`;
    const config: TestTableConfig = {
      ...EVAL_TEST_TABLE,
      name: uniqueName,
    };

    // Setup: create test table
    await createTestTable(config);
    console.log(`[fixture] Created eval test table: ${uniqueName}`);

    // Use the table in the test
    await use(config);

    // Teardown: delete test table
    await deleteTestTable(uniqueName).catch(() => {});
    console.log(`[fixture] Deleted eval test table: ${uniqueName}`);
  },
});

test.describe("Evals Playground", () => {
  test("can load evals page", async ({ page }) => {
    await page.goto("/playground/evals");

    // Should see the Evals Playground heading
    await expect(page.getByRole("heading", { name: /Evals|Evaluation/i })).toBeVisible({ timeout: 10000 });
  });

  test("can create an eval set", async ({ page }) => {
    await page.goto("/playground/evals");

    // Wait for page to load
    await expect(page.getByRole("heading", { name: /Evals|Evaluation/i })).toBeVisible({ timeout: 10000 });

    // Click "New Set" button
    const newSetButton = page.getByRole("button", { name: /New Set|Create/i });
    await expect(newSetButton).toBeVisible({ timeout: 5000 });
    await newSetButton.click();

    // Fill in the eval set name
    const nameInput = page.getByLabel(/Name/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill("E2E Test Eval Set");

    // Submit the form
    const createButton = page.getByRole("button", { name: /Create|Save/i });
    await createButton.click();

    // Should see the new eval set in the dropdown or list
    await expect(page.getByText("E2E Test Eval Set")).toBeVisible({ timeout: 5000 });
  });

  test("can add an eval item to a set", async ({ page }) => {
    await page.goto("/playground/evals");

    // Wait for page to load
    await expect(page.getByRole("heading", { name: /Evals|Evaluation/i })).toBeVisible({ timeout: 10000 });

    // First create an eval set
    const newSetButton = page.getByRole("button", { name: /New Set/i });
    await expect(newSetButton).toBeVisible({ timeout: 5000 });
    await newSetButton.click();

    const nameInput = page.getByLabel(/Name/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill("E2E Test Eval Set With Items");
    await page.getByRole("button", { name: /Create|Save/i }).click();
    await page.waitForTimeout(500);

    // Click "Add Item" button
    const addItemButton = page.getByRole("button", { name: /Add Item|Add Question/i });
    await expect(addItemButton).toBeVisible({ timeout: 5000 });
    await addItemButton.click();

    // Fill in the question
    const questionInput = page.getByLabel(/Question/i);
    await expect(questionInput).toBeVisible({ timeout: 3000 });
    await questionInput.fill("What is the capital of France?");

    // Fill in the reference answer
    const answerInput = page.getByLabel(/Reference|Answer/i);
    await expect(answerInput).toBeVisible({ timeout: 3000 });
    await answerInput.fill("Paris is the capital of France.");

    // Submit - find the Add button in the dialog
    const addButton = page.locator("button").filter({ hasText: /^Add$/ });
    await addButton.click();

    // Should see the question in the list
    await expect(page.getByText("What is the capital of France?")).toBeVisible({ timeout: 5000 });
  });

  test("can run an eval and generate RAG answers", async ({ page, evalTestTable }) => {
    // This test exercises the full eval flow and will fail until /agents/retrieval is implemented
    await page.goto("/playground/evals");

    // Wait for page to load
    await expect(page.getByRole("heading", { name: /Evals|Evaluation/i })).toBeVisible({ timeout: 10000 });

    // Step 1: Create an eval set
    const newSetButton = page.getByRole("button", { name: /New Set/i });
    await expect(newSetButton).toBeVisible({ timeout: 5000 });
    await newSetButton.click();

    const nameInput = page.getByLabel(/Name/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });
    await nameInput.fill("E2E RAG Eval Test");
    await page.getByRole("button", { name: /Create|Save/i }).click();
    await page.waitForTimeout(1000);

    // Step 2: Add an eval item
    const addItemButton = page.getByRole("button", { name: /Add Item|Add Question/i });
    await expect(addItemButton).toBeVisible({ timeout: 5000 });
    await addItemButton.click();

    const questionInput = page.getByLabel(/Question/i);
    await expect(questionInput).toBeVisible({ timeout: 3000 });
    await questionInput.fill("What is the capital of France?");

    const answerInput = page.getByLabel(/Reference|Answer/i);
    await expect(answerInput).toBeVisible({ timeout: 3000 });
    await answerInput.fill("Paris is the capital of France.");

    const addButton = page.locator("button").filter({ hasText: /^Add$/ });
    await addButton.click();
    await page.waitForTimeout(1000);

    // Step 3: Select a table from the dropdown
    // The evals page has a table selector - find and interact with it
    // Look for a Select component with "Table" in its trigger
    const tableSelectTrigger = page.locator("[data-slot='select-trigger']").filter({ hasText: /table/i }).first();

    if (await tableSelectTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tableSelectTrigger.click();
      await page.waitForTimeout(500);

      // Try to find our test table in the dropdown
      const tableOption = page.locator("[data-slot='select-item']").filter({ hasText: evalTestTable.name });
      if (await tableOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tableOption.click();
      } else {
        // Fall back to clicking any available table
        const anyTable = page.locator("[data-slot='select-item']").first();
        if (await anyTable.isVisible({ timeout: 2000 }).catch(() => false)) {
          await anyTable.click();
        }
      }
      await page.waitForTimeout(500);
    }

    // Listen for console errors to capture the API error
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Step 4: Click Run Evaluation
    // Scroll down to make sure the button is visible
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const runButton = page.getByRole("button", { name: /Run Evaluation|Run|Start/i });

    // Take screenshot before clicking run to see state
    await page.screenshot({ path: "/tmp/evals-before-run.png", fullPage: true });

    if (await runButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await runButton.scrollIntoViewIfNeeded();
      await runButton.click({ timeout: 10000 });

      // Wait for the API call to complete (success or error)
      await page.waitForTimeout(5000);

      // Take screenshot after run attempt
      await page.screenshot({ path: "/tmp/evals-after-run.png", fullPage: true });

      // Log any console errors
      if (errors.length > 0) {
        console.log("Console errors captured:", errors.join("\n"));
      }

      // Check for error indicators in the Results section
      // The UI shows "Errors: N" when there are failures
      const errorsIndicator = page.locator("text=/Errors:\\s*[1-9]/i");
      const passedIndicator = page.locator("text=/Passed:\\s*[1-9]/i");

      const hasErrors = await errorsIndicator.isVisible({ timeout: 5000 }).catch(() => false);
      const hasPassed = await passedIndicator.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasErrors && !hasPassed) {
        // The eval ran but had errors - this is the expected state until API is fixed
        const errorCount = await errorsIndicator.textContent().catch(() => "Errors: unknown");
        console.log(`Eval completed with errors: ${errorCount}`);
        console.log("This is expected until /agents/retrieval endpoint is implemented");

        // Fail the test with a clear message
        expect(false,
          `Eval failed with ${errorCount}. ` +
          "This test will pass once the /agents/retrieval endpoint is implemented in the backend. " +
          "Console error: " + (errors[0] || "none captured")
        ).toBe(true);
      } else if (hasPassed) {
        // Success! All evals passed
        const passedCount = await passedIndicator.textContent().catch(() => "Passed: unknown");
        console.log(`Eval completed successfully: ${passedCount}`);
        expect(hasPassed).toBe(true);
      } else {
        // Neither errors nor passed - check if still loading or something else
        const pageText = await page.locator("body").textContent();
        const hasAnyError = pageText?.includes("Error") || pageText?.includes("404") || pageText?.includes("failed");

        if (hasAnyError) {
          expect(false,
            "Eval failed - check /tmp/evals-after-run.png for details"
          ).toBe(true);
        } else {
          // Might still be loading or no results yet
          expect(false,
            "Eval did not complete - no results or errors shown. Check /tmp/evals-after-run.png"
          ).toBe(true);
        }
      }
    } else {
      // Run button not visible - take screenshot and skip
      await page.screenshot({ path: "/tmp/evals-no-run-button.png", fullPage: true });
      expect(false, "Run button not visible - check screenshot at /tmp/evals-no-run-button.png").toBe(true);
    }
  });
});
