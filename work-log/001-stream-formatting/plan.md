# Streaming Formatting Fix Plan

## Problem Statement

The Answerbar's streaming answer displays formatting issues:
1. **Double/triple quotes** appearing mid-word (e.g., `"""Learning"`, `"Be""ginner"`)
2. **Raw `\n` characters** instead of line breaks
3. **Raw markdown asterisks** (`*`) instead of rendered bullet points

## Root Cause Analysis

### SDK Parsing (Verified Correct)
The SDK at `packages/sdk/src/client.ts:430-434` correctly parses JSON-encoded chunks:
```typescript
case "answer":
  if (callbacks.onAnswer) {
    // Answer is JSON-encoded to preserve newlines in SSE format
    callbacks.onAnswer(JSON.parse(data));
  }
```
The double-quote issue is **not** caused by SDK parsing - it's likely coming from the backend/LLM output.

### Current Default Renderer (The Problem)
`packages/components/src/AnswerResults.tsx:354-362`:
```typescript
const defaultRenderAnswer = useCallback(
  (answerText: string, streaming: boolean, _hits?: QueryHit[]) => (
    <div className="react-af-answer-text">
      {answerText}  // ← Raw text, no markdown processing!
      {streaming && <span className="react-af-answer-streaming"> ...</span>}
    </div>
  ),
  []
);
```

The default renderer outputs raw text with no markdown processing, which is why:
- `\n` stays as text (not rendered as line breaks)
- `*` stays as asterisks (not rendered as bullets)

## Implementation Plan

### Step 1: Move streamdown to dependencies
**File:** `packages/components/package.json`

Move `"streamdown": "^1.6.11"` from `devDependencies` (line 81) to `dependencies` (after line 51).

### Step 2: Create markdown preprocessing utility
**File:** `packages/components/src/markdown.ts` (new file)

```typescript
/**
 * Preprocess streaming text for markdown rendering.
 * Handles literal \n strings that may come from LLM output.
 */
export function preprocessStreamingText(text: string): string {
  // Replace literal \n with actual newlines if any escaped ones remain
  return text.replace(/\\n/g, '\n');
}
```

### Step 3: Update AnswerResults default renderer
**File:** `packages/components/src/AnswerResults.tsx`

Add imports:
```typescript
import { Streamdown } from "streamdown";
import { replaceCitations, renderAsMarkdownLinks } from "./citations";
import { preprocessStreamingText } from "./markdown";
```

Update `defaultRenderAnswer` (lines 354-362):
```typescript
const defaultRenderAnswer = useCallback(
  (answerText: string, streaming: boolean, _hits?: QueryHit[]) => {
    const processedText = preprocessStreamingText(answerText);
    const textWithLinks = processedText
      ? replaceCitations(processedText, {
          renderCitation: renderAsMarkdownLinks,
        })
      : "";

    return (
      <div className="react-af-answer-text">
        <Streamdown isAnimating={streaming}>{textWithLinks}</Streamdown>
      </div>
    );
  },
  []
);
```

Update `defaultRenderReasoning` (lines 341-352) similarly.

### Step 4: Update RAGResults default renderer
**File:** `packages/components/src/RAGResults.tsx`

Apply same pattern - add Streamdown for markdown rendering in the default summary renderer.

### Step 5: Export the utility
**File:** `packages/components/src/index.ts`

```typescript
export { preprocessStreamingText } from "./markdown";
```

## Files to Modify

| File | Change |
|------|--------|
| `packages/components/package.json` | Move streamdown to dependencies |
| `packages/components/src/markdown.ts` | Create new preprocessing utility |
| `packages/components/src/AnswerResults.tsx` | Update default renderers with Streamdown |
| `packages/components/src/RAGResults.tsx` | Update default renderer with Streamdown |
| `packages/components/src/index.ts` | Export new utility |

## Regarding Double-Quote Issue

The double-quote artifacts (`"""Learning"`, `"Be""ginner"`) are **not** caused by SDK parsing. After implementing the markdown rendering fix, we should:

1. Test if the issue persists
2. If yes, add debug logging to the SDK to capture raw SSE data
3. The root cause is likely in the backend/LLM output, requiring a backend fix

## Verification Steps

1. Run tests: `pnpm --filter @antfly/components test`
2. Run storybook: `pnpm --filter @antfly/components storybook`
3. Verify in storybook:
   - Bullet points (`*`) render as list items
   - Newlines render as line breaks
   - Citations become clickable markdown links
4. Check if double-quote artifacts persist (may need backend investigation)
