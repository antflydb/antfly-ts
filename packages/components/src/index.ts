import "./style.css";
import ActiveFilters from "./ActiveFilters";
import AnswerFeedback from "./AnswerFeedback";
import AnswerResults from "./AnswerResults";
import { useAnswerResultsContext } from "./AnswerResultsContext";
import Antfly from "./Antfly";
import Autosuggest, {
  AutosuggestFacets,
  AutosuggestResults,
  useAutosuggestContext,
} from "./Autosuggest";
import CustomWidget from "./CustomWidget";
import {
  getCitedDocumentIds,
  getCitedResourceIds,
  parseCitations,
  renderAsMarkdownLinks,
  renderAsSequentialLinks,
  replaceCitations,
} from "./citations";
import Facet from "./Facet";
import { renderNumeric, renderStars, renderThumbsUpDown } from "./feedback-renderers";
import { useAnswerStream } from "./hooks/useAnswerStream";
import { useCitations } from "./hooks/useCitations";
import { useSearchHistory } from "./hooks/useSearchHistory";
import Listener from "./Listener";
import Pagination from "./Pagination";
import QueryBox from "./QueryBox";
import Results from "./Results";
import {
  fromUrlQueryString,
  getAntflyClient,
  initializeAntflyClient,
  multiquery,
  streamAnswer,
  toUrlQueryString,
} from "./utils";

export {
  Antfly,
  Results,
  QueryBox,
  Facet,
  Pagination,
  Listener,
  fromUrlQueryString,
  toUrlQueryString,
  ActiveFilters,
  CustomWidget,
  Autosuggest,
  AutosuggestResults,
  AutosuggestFacets,
  useAutosuggestContext,
  AnswerResults,
  useAnswerResultsContext,
  AnswerFeedback,
  renderThumbsUpDown,
  renderStars,
  renderNumeric,
  multiquery as msearch,
  initializeAntflyClient,
  getAntflyClient,
  streamAnswer,
  parseCitations,
  replaceCitations,
  renderAsMarkdownLinks,
  renderAsSequentialLinks,
  getCitedDocumentIds,
  getCitedResourceIds,
  useSearchHistory,
  useAnswerStream,
  useCitations,
};

export type {
  GeneratorConfig,
  RetrievalAgentRequest,
  RetrievalAgentResult,
} from "@antfly/sdk";
export type { ActiveFilter, ActiveFiltersProps } from "./ActiveFilters";
export type { AnswerFeedbackProps, FeedbackResult } from "./AnswerFeedback";
export type { AnswerResultsProps } from "./AnswerResults";
export type { AnswerResultsContextValue } from "./AnswerResultsContext";
// Export types for users of the library
export type { AntflyProps } from "./Antfly";
export type {
  AutosuggestContextValue,
  AutosuggestFacetsProps,
  AutosuggestProps,
  AutosuggestResultsProps,
} from "./Autosuggest";
export type { CustomWidgetProps } from "./CustomWidget";
export type { Citation, CitationRenderOptions } from "./citations";
export type { FacetProps } from "./Facet";
export type { QueryClassification } from "./hooks/useAnswerStream";
export type {
  CitationMetadata,
  SearchHistory,
  SearchResult,
} from "./hooks/useSearchHistory";
export type { PaginationProps } from "./Pagination";
export type { CustomInputProps, QueryBoxProps } from "./QueryBox";
export type { ResultsProps } from "./Results";
export type { SharedAction, SharedState, Widget } from "./SharedContext";
export type { AnswerCallbacks, MultiqueryRequest } from "./utils";
