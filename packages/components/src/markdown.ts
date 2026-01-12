/**
 * Preprocess streaming text for markdown rendering.
 * Handles literal \n strings that may come from LLM output.
 */
export function preprocessStreamingText(text: string): string {
  // Replace literal \n with actual newlines if any escaped ones remain
  return text.replace(/\\n/g, "\n");
}
