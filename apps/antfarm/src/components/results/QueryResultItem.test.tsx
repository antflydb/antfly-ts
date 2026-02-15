/**
 * Unit tests for QueryResultItem component
 *
 * Tests verify that:
 * - Score is displayed without star ratings
 * - Score label "Score:" is shown instead of star icon
 * - Tooltip indicator (cursor-help) is present for score explanation
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import QueryResultItem from "./QueryResultItem";

describe("QueryResultItem", () => {
  const mockHit = {
    _id: "test-doc-1",
    _source: {
      title: "Test Document",
      content: "This is test content",
    },
    _score: 0.0164,
  };

  it("should display score value without stars", () => {
    render(
      <QueryResultItem hit={mockHit} index={0} isExpanded={false} onToggle={() => {}} />
    );

    // Score should be displayed
    const scoreElement = screen.getByText("0.0164");
    expect(scoreElement).toBeTruthy();

    // Stars should NOT be present (we removed them)
    // The old implementation had 5 stars with fill-yellow-400 class
    const stars = document.querySelectorAll('[class*="fill-yellow"]');
    expect(stars.length).toBe(0);
  });

  it("should display score label instead of star icon", () => {
    render(
      <QueryResultItem hit={mockHit} index={0} isExpanded={false} onToggle={() => {}} />
    );

    // Should have "Score:" labels (in badge and expanded view)
    const scoreLabels = screen.getAllByText("Score:");
    expect(scoreLabels.length).toBeGreaterThan(0);
  });

  it("should have tooltip container with cursor-help for score", () => {
    render(
      <QueryResultItem hit={mockHit} index={0} isExpanded={false} onToggle={() => {}} />
    );

    // The badge should have cursor-help class indicating tooltip presence
    const tooltipElements = document.querySelectorAll('[class*="cursor-help"]');
    expect(tooltipElements.length).toBeGreaterThan(0);
  });

  it("should not display score section when score is undefined", () => {
    const hitWithoutScore = {
      _id: "test-doc-2",
      _source: { title: "No Score" },
    };

    const { container } = render(
      <QueryResultItem hit={hitWithoutScore} index={0} isExpanded={false} onToggle={() => {}} />
    );

    // Should not have score label in this specific component render
    const scoreLabels = container.querySelectorAll('[class*="cursor-help"]');
    expect(scoreLabels.length).toBe(0);
  });
});
