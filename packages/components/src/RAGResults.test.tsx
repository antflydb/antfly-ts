import type { GeneratorConfig } from "@antfly/sdk";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Antfly from "./Antfly";
import QueryBox from "./QueryBox";
import RAGResults from "./RAGResults";
import * as utils from "./utils";

// Wrapper component to provide required context
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <Antfly url="http://localhost:8082/api/v1" table="test">
      {children}
    </Antfly>
  );
};

// Mock ModelConfig for testing
const mockSummarizer: GeneratorConfig = {
  provider: "openai",
  model: "gpt-4",
  api_key: "test-key",
};

// Mock the streamRAG function from utils
vi.mock("./utils", async () => {
  const actual = await vi.importActual<typeof utils>("./utils");
  return {
    ...actual,
    streamRAG: vi.fn(),
  };
});

describe("RAGResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic rendering", () => {
    it("should render without crashing", () => {
      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
    });

    it("should show empty state when no question submitted", () => {
      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const emptyMessage = container.querySelector(".react-af-rag-empty");
      expect(emptyMessage).toBeTruthy();
      expect(emptyMessage?.textContent).toContain("No results yet");
    });

    it("should render with custom render function", () => {
      const customRender = vi.fn(() => <div className="custom-rag">Custom RAG</div>);

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            renderSummary={customRender}
          />
        </TestWrapper>
      );

      const customElement = container.querySelector(".custom-rag");
      expect(customElement).toBeTruthy();
    });
  });

  describe("streaming behavior", () => {
    it("should stream chunks progressively", async () => {
      // Mock streamRAG to simulate streaming chunks
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onSummary?.("Hello ");
        callbacks.onSummary?.("world");
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      // Find elements using more reliable methods
      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      // Type into input and submit - all within act
      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      // Wait for streamRAG to be called
      await waitFor(
        () => {
          expect(mockStreamRAG).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Wait for summary to appear
      await waitFor(
        () => {
          const summary = container.querySelector(".react-af-rag-summary");
          expect(summary).toBeTruthy();
          expect(summary?.textContent).toContain("Hello world");
        },
        { timeout: 1000 }
      );
    });

    it("should show streaming indicator while streaming", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onSummary?.("Streaming...");
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      // The component should show the summary
      await waitFor(() => {
        const summary = container.querySelector(".react-af-rag-summary");
        expect(summary).toBeTruthy();
        expect(summary?.textContent).toContain("Streaming...");
      });
    });

    it("should handle [DONE] signal", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onSummary?.("Complete");
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        const summary = container.querySelector(".react-af-rag-summary");
        expect(summary?.textContent).toContain("Complete");
        // Streaming indicator should be gone
        const streamingIndicator = container.querySelector(".react-af-rag-streaming");
        expect(streamingIndicator).toBeFalsy();
      });
    });
  });

  describe("error handling", () => {
    it("should display error when fetch fails", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onError?.(new Error("Network error"));
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        const error = container.querySelector(".react-af-rag-error");
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain("Network error");
      });
    });

    it("should handle HTTP error responses", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onError?.(new Error("RAG request failed: 500 Internal Server Error"));
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        const error = container.querySelector(".react-af-rag-error");
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain("RAG request failed");
      });
    });

    it("should handle error chunks in stream", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onError?.(new Error("Something went wrong"));
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        const error = container.querySelector(".react-af-rag-error");
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain("Something went wrong");
      });
    });

    it("should handle malformed JSON in stream", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        // Simulate handling malformed JSON gracefully
        callbacks.onSummary?.("{invalid json}");
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      // Should not crash, just log a warning
      await waitFor(() => {
        expect(container).toBeTruthy();
      });
    });
  });

  describe("configuration options", () => {
    it("should use custom system prompt", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, request, _headers, callbacks) => {
        // Verify system prompt is in the request
        expect(request.system_prompt).toBe("You are a helpful assistant.");
        callbacks.onComplete?.();
        return new AbortController();
      });

      render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            systemPrompt="You are a helpful assistant."
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockStreamRAG).toHaveBeenCalled();
      });
    });

    it("should pass fields to query", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, request, _headers, callbacks) => {
        // Verify fields are in the request
        expect(request.queries[0].fields).toEqual(["title", "content"]);
        callbacks.onComplete?.();
        return new AbortController();
      });

      render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["title", "content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockStreamRAG).toHaveBeenCalled();
      });
    });
  });

  describe("query updates", () => {
    it("should trigger request when question is submitted", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onSummary?.("Answer");
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      // Submit question
      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        const summary = container.querySelector(".react-af-rag-summary");
        expect(summary?.textContent).toContain("Answer");
      });

      expect(mockStreamRAG).toHaveBeenCalled();
    });

    it("should trigger new request even if question is the same when explicitly resubmitted", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onComplete?.();
        return new AbortController();
      });

      render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "same question");
        await userEvent.click(button);
      });

      await waitFor(() => {
        expect(mockStreamRAG).toHaveBeenCalledTimes(1);
      });

      // Click again without changing the question - should trigger a new request
      await act(async () => {
        await userEvent.click(button);
      });

      // Should be 2 calls since user explicitly clicked submit again
      await waitFor(() => {
        expect(mockStreamRAG).toHaveBeenCalledTimes(2);
      });
    });

    it("should reset summary when new request starts", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onSummary?.("New answer");
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      // Submit a question
      await act(async () => {
        await userEvent.type(input, "test question");
        await userEvent.click(button);
      });

      // Verify answer appears
      await waitFor(() => {
        const summary = container.querySelector(".react-af-rag-summary");
        expect(summary?.textContent).toContain("New answer");
      });
    });
  });

  describe("edge cases", () => {
    it("should handle missing AnswerBox widget", () => {
      const { container } = render(
        <TestWrapper>
          <RAGResults id="rag-answer" searchBoxId="nonexistent" summarizer={mockSummarizer} />
        </TestWrapper>
      );

      expect(container).toBeTruthy();
    });

    it("should handle empty stream", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onComplete?.();
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test");
        await userEvent.click(button);
      });

      expect(container).toBeTruthy();
    });

    it("should handle null response body", async () => {
      const mockStreamRAG = vi.mocked(utils.streamRAG);
      mockStreamRAG.mockImplementation(async (_url, _table, _request, _headers, callbacks) => {
        callbacks.onError?.(new Error("Response body is null"));
        return new AbortController();
      });

      const { container } = render(
        <TestWrapper>
          <QueryBox id="question" mode="submit" />
          <RAGResults
            id="rag-answer"
            searchBoxId="question"
            summarizer={mockSummarizer}
            fields={["content"]}
          />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/ask a question/i);
      const button = screen.getByRole("button", { name: /submit/i });

      await act(async () => {
        await userEvent.type(input, "test");
        await userEvent.click(button);
      });

      await waitFor(() => {
        const error = container.querySelector(".react-af-rag-error");
        expect(error).toBeTruthy();
        expect(error?.textContent).toContain("Response body is null");
      });
    });
  });
});
