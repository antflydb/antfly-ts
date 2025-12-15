import type { RAGResult } from "@antfly/sdk";
import { render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { createContext, useContext } from "react";
import { describe, expect, it, vi } from "vitest";
import AnswerFeedback from "./AnswerFeedback";
import { renderNumeric, renderStars, renderThumbsUpDown } from "./feedback-renderers";

// Mock RAGResults module with proper context export
vi.mock("./RAGResults", () => {
  const mockContext = createContext<{
    query: string;
    result: RAGResult | null;
    isStreaming: boolean;
  } | null>(null);

  return {
    RAGResultsContext: mockContext,
    useRAGResultsContext: () => {
      const context = useContext(mockContext);
      if (!context) {
        throw new Error("useRAGResultsContext must be used within a RAGResults component");
      }
      return context;
    },
  };
});

// Mock AnswerResultsContext module (returns null since we're testing RAG context)
vi.mock("./AnswerResultsContext", () => ({
  AnswerResultsContext: createContext(null),
  useAnswerResultsContext: () => {
    throw new Error("useAnswerResultsContext must be used within an AnswerResults component");
  },
}));

// Import the mocked context after mocking
const { RAGResultsContext } = await import("./RAGResults");

// Mock context provider for testing
const MockRAGResultsProvider = ({
  children,
  query = "test query",
  result = {
    generate_result: { text: "Test summary" },
    query_results: [
      {
        hits: {
          hits: [
            {
              _id: "1",
              _score: 0.9,
              _source: { content: "test content" },
            },
          ],
          total: 1,
        },
      },
    ],
  } as unknown as RAGResult,
  isStreaming = false,
}: {
  children: React.ReactNode;
  query?: string;
  result?: RAGResult | null;
  isStreaming?: boolean;
}) => {
  return (
    <RAGResultsContext.Provider value={{ query, result, isStreaming }}>
      {children}
    </RAGResultsContext.Provider>
  );
};

describe("AnswerFeedback", () => {
  describe("basic rendering", () => {
    it("should render with context", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      expect(container.querySelector(".react-af-answer-feedback")).toBeTruthy();
    });

    it("should not render without result", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider result={null}>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      expect(container.querySelector(".react-af-answer-feedback")).toBeNull();
    });

    it("should not render while streaming", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider isStreaming={true}>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      expect(container.querySelector(".react-af-answer-feedback")).toBeNull();
    });
  });

  describe("default renderers", () => {
    it("should render thumbs up/down", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      expect(container.querySelector(".react-af-feedback-thumbs")).toBeTruthy();
      expect(container.querySelectorAll(".react-af-feedback-thumbs button")).toHaveLength(2);
    });

    it("should render stars", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback scale={4} renderRating={renderStars} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      expect(container.querySelector(".react-af-feedback-stars")).toBeTruthy();
      expect(container.querySelectorAll(".react-af-feedback-star")).toHaveLength(5);
    });

    it("should render numeric scale", () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback
            scale={3}
            renderRating={(rating, onRate) => renderNumeric(rating, onRate, 3)}
            onFeedback={onFeedback}
          />
        </MockRAGResultsProvider>
      );

      expect(container.querySelector(".react-af-feedback-numeric")).toBeTruthy();
      expect(container.querySelectorAll(".react-af-feedback-number")).toHaveLength(4);
    });
  });

  describe("interaction", () => {
    it("should show submit button after rating", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      // Initially no submit button
      expect(container.querySelector(".react-af-feedback-submit")).toBeNull();

      // Click thumbs up
      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      // Submit button should appear
      await waitFor(() => {
        expect(container.querySelector(".react-af-feedback-submit")).toBeTruthy();
      });
    });

    it("should call onFeedback when submitted", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider query="What is AI?">
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      // Click thumbs up
      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      // Click submit
      const submitButton = await waitFor(() => {
        const btn = container.querySelector(".react-af-feedback-submit") as HTMLElement;
        expect(btn).toBeTruthy();
        return btn;
      });
      await userEvent.click(submitButton);

      // Check feedback was called
      await waitFor(() => {
        expect(onFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.objectContaining({
              rating: 1,
              scale: 1,
            }),
            query: "What is AI?",
          })
        );
      });
    });

    it("should hide after submission", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      // Click and submit
      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      const submitButton = await waitFor(() => {
        const btn = container.querySelector(".react-af-feedback-submit") as HTMLElement;
        expect(btn).toBeTruthy();
        return btn;
      });
      await userEvent.click(submitButton);

      // Component should be hidden
      await waitFor(() => {
        expect(container.querySelector(".react-af-answer-feedback")).toBeNull();
      });
    });
  });

  describe("comments", () => {
    it("should show comment field when renderComment is provided", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback
            scale={1}
            renderRating={renderThumbsUpDown}
            renderComment={(comment, setComment) => (
              <textarea
                className="react-af-feedback-comment-input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
            onFeedback={onFeedback}
          />
        </MockRAGResultsProvider>
      );

      // Click rating
      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      // Comment field should appear
      await waitFor(() => {
        expect(container.querySelector(".react-af-feedback-comment-input")).toBeTruthy();
      });
    });

    it("should not show comment field when renderComment is not provided", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback scale={1} renderRating={renderThumbsUpDown} onFeedback={onFeedback} />
        </MockRAGResultsProvider>
      );

      // Click rating
      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      // Wait for submit button but verify no comment field
      await waitFor(() => {
        expect(container.querySelector(".react-af-feedback-submit")).toBeTruthy();
      });
      expect(container.querySelector(".react-af-feedback-comment-input")).toBeNull();
    });

    it("should include comment in feedback data", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback
            scale={1}
            renderRating={renderThumbsUpDown}
            renderComment={(comment, setComment) => (
              <textarea
                className="react-af-feedback-comment-input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
            onFeedback={onFeedback}
          />
        </MockRAGResultsProvider>
      );

      // Click rating
      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      // Type comment
      const commentField = await waitFor(() => {
        const field = container.querySelector(
          ".react-af-feedback-comment-input"
        ) as HTMLTextAreaElement;
        expect(field).toBeTruthy();
        return field;
      });
      await userEvent.type(commentField, "Great answer!");

      // Submit
      const submitButton = container.querySelector(
        ".react-af-feedback-submit"
      ) as HTMLButtonElement;
      await userEvent.click(submitButton);

      // Check comment was included
      await waitFor(() => {
        expect(onFeedback).toHaveBeenCalledWith(
          expect.objectContaining({
            feedback: expect.objectContaining({
              rating: 1,
              scale: 1,
              comment: "Great answer!",
            }),
          })
        );
      });
    });
  });

  describe("custom render props", () => {
    it("should use custom renderComment with placeholder", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback
            scale={1}
            renderRating={renderThumbsUpDown}
            renderComment={(comment, setComment) => (
              <textarea
                className="react-af-feedback-comment-input"
                placeholder="Tell us more..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
            onFeedback={onFeedback}
          />
        </MockRAGResultsProvider>
      );

      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      const commentField = await waitFor(() => {
        const field = container.querySelector(
          ".react-af-feedback-comment-input"
        ) as HTMLTextAreaElement;
        expect(field).toBeTruthy();
        return field;
      });

      expect(commentField.placeholder).toBe("Tell us more...");
    });

    it("should use custom renderSubmit", async () => {
      const onFeedback = vi.fn();
      const { container } = render(
        <MockRAGResultsProvider>
          <AnswerFeedback
            scale={1}
            renderRating={renderThumbsUpDown}
            renderSubmit={(onSubmit) => (
              <button type="button" className="custom-submit" onClick={onSubmit}>
                Send Feedback
              </button>
            )}
            onFeedback={onFeedback}
          />
        </MockRAGResultsProvider>
      );

      const thumbsUp = container.querySelector(".react-af-feedback-thumb-up") as HTMLElement;
      await userEvent.click(thumbsUp);

      const submitButton = await waitFor(() => {
        const btn = container.querySelector(".custom-submit") as HTMLButtonElement;
        expect(btn).toBeTruthy();
        return btn;
      });

      expect(submitButton.textContent).toBe("Send Feedback");
    });
  });
});
