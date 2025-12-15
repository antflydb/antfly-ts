import "@testing-library/jest-dom";
import { afterEach, beforeEach, vi } from "vitest";

// Configure React to recognize the test environment
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Suppress act() warnings during tests
// These warnings occur with async state updates in streaming components (like RAGResults)
// and don't affect test correctness
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    const message = typeof args[0] === "string" ? args[0] : "";
    if (message.includes("not configured to support act")) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterEach(() => {
  console.error = originalError;
});

// Mock the @antfly/sdk module
vi.mock("@antfly/sdk", () => {
  return {
    AntflyClient: vi.fn(function () {
      this.multiquery = vi.fn(async (queries) => {
        // Return mock successful responses for each query
        return {
          responses: queries.map(() => ({
            status: 200,
            took: 1,
            hits: {
              hits: [
                {
                  _id: "mock-doc-1",
                  _source: {
                    title: "Mock Result 1",
                    description: "Mock description",
                  },
                },
                {
                  _id: "mock-doc-2",
                  _source: {
                    title: "Mock Result 2",
                    description: "Another mock",
                  },
                },
              ],
              total: 2,
            },
            facets: {},
          })),
        };
      });
    }),
  };
});
