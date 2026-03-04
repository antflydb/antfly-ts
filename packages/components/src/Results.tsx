import type { QueryHit } from "@antfly/sdk";
import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import Pagination from "./Pagination";
import { useSharedContext } from "./SharedContext";
import { disjunctsFrom } from "./utils";

export interface ResultsProps {
  id: string;
  searchBoxId?: string; // Links to the QueryBox that provides the search value (optional for backward compatibility)

  // Query configuration (moved from SearchBox) - only used if searchBoxId is provided
  fields?: string[];
  customQuery?: (query?: string) => unknown;
  semanticIndexes?: string[];
  limit?: number;

  // Display configuration
  itemsPerPage?: number;
  initialPage?: number;
  pagination?: (
    total: number,
    itemsPerPage: number,
    page: number,
    setPage: (page: number) => void
  ) => ReactNode;
  stats?: (total: number) => ReactNode;
  items: (data: QueryHit[]) => ReactNode;

  // Optional overrides
  sort?: unknown;
  table?: string; // Optional table override (Phase 1: single table only)
  filterQuery?: Record<string, unknown>; // Filter query to constrain search results
  exclusionQuery?: Record<string, unknown>; // Exclusion query to exclude matches
}

export default function Results({
  id,
  searchBoxId,
  fields,
  customQuery,
  semanticIndexes,
  limit,
  itemsPerPage = 10,
  initialPage = 1,
  pagination,
  stats,
  items,
  sort,
  table,
  filterQuery,
  exclusionQuery,
}: ResultsProps) {
  const [{ widgets }, dispatch] = useSharedContext();
  const [page, setPage] = useState(initialPage);
  const [lastQueryHash, setLastQueryHash] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const widget = widgets.get(id);
  const data = widget?.result?.data ? widget.result.data : [];
  const total = widget?.result?.total
    ? typeof widget.result.total === "object" &&
      widget.result.total !== null &&
      "value" in widget.result.total
      ? (widget.result.total as { value: number }).value
      : (widget.result.total as number)
    : 0;

  // Get the search value from the linked QueryBox (if searchBoxId is provided)
  const searchBoxWidget = searchBoxId ? widgets.get(searchBoxId) : undefined;
  const searchValue = (searchBoxWidget?.value as string) || "";

  // Determine if semantic search is enabled
  const isSemanticEnabled = !!(searchBoxId && semanticIndexes && semanticIndexes.length > 0);

  // Stable serialized keys for array/object props to prevent unnecessary re-renders
  // These props are often created inline (e.g., semanticIndexes={[tableSlug]}) which
  // produces new references on every render, causing useEffect/useCallback to re-fire.
  const fieldsKey = JSON.stringify(fields);
  const semanticIndexesKey = JSON.stringify(semanticIndexes);
  const filterQueryKey = JSON.stringify(filterQuery);
  const exclusionQueryKey = JSON.stringify(exclusionQuery);

  // Build a query from the search value
  // biome-ignore lint/correctness/useExhaustiveDependencies: Using stable serialized fieldsKey instead of fields array reference
  const queryFromValue = useCallback(
    (query: string): unknown => {
      if (isSemanticEnabled) return query;
      if (customQuery) {
        return customQuery(query);
      } else if (fields) {
        const termQueries: Array<Record<string, unknown>> = [];
        fields.forEach((field) => {
          termQueries.push({ match: query, field });
        });
        // Add match_phrase queries when there are multiple terms
        // This boosts results where the exact phrase appears in order
        const hasMultipleTerms = query.trim().includes(" ");
        if (hasMultipleTerms) {
          fields.forEach((field) => {
            termQueries.push({ match_phrase: query, field });
          });
        }
        return query ? disjunctsFrom(termQueries) : { match_all: {} };
      }
      return { match_all: {} };
    },
    [isSemanticEnabled, customQuery, fieldsKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Create a hash of all search/filter widgets to detect query changes
  const queryWidgets = Array.from(widgets.values()).filter((w) => w.needsQuery);
  const queryHash = JSON.stringify(
    queryWidgets.map((w) => ({ id: w.id, value: w.value, query: w.query }))
  );

  // Compute the desired page based on query changes
  const desiredPage = React.useMemo(() => {
    if (queryHash !== lastQueryHash) {
      return !isInitialized ? initialPage : 1;
    }
    return page;
  }, [queryHash, lastQueryHash, isInitialized, initialPage, page]);

  // Update state after query hash changes
  useEffect(() => {
    if (queryHash !== lastQueryHash) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastQueryHash(queryHash);
      setIsInitialized(true);
      if (desiredPage !== page) {
        setPage(desiredPage);
      }
    }
  }, [queryHash, lastQueryHash, desiredPage, page]);

  // Update context with query and configuration
  useEffect(() => {
    // If searchBoxId is provided, Results contributes the search query
    // Otherwise, it just wants results (backward compatibility with old SearchBox)
    const shouldContributeQuery = !!searchBoxId;

    dispatch({
      type: "setWidget",
      key: id,
      needsQuery: shouldContributeQuery,
      needsConfiguration: true, // Results always has configuration (itemsPerPage, page, sort, fields)
      isFacet: false,
      rootQuery: false, // Not a root query - doesn't need isolation
      wantResults: true,
      isSemantic: isSemanticEnabled,
      query: shouldContributeQuery
        ? isSemanticEnabled
          ? customQuery
            ? customQuery()
            : null
          : queryFromValue(searchValue)
        : undefined,
      semanticQuery: shouldContributeQuery && isSemanticEnabled ? searchValue : undefined,
      table: table,
      filterQuery: filterQuery,
      exclusionQuery: exclusionQuery,
      configuration:
        shouldContributeQuery && isSemanticEnabled
          ? {
              indexes: semanticIndexes || [],
              limit: limit || 10,
              itemsPerPage,
              page,
              sort,
              fields,
            }
          : { itemsPerPage, page, sort, fields },
      // Don't pass result here - it should only be set by the Listener after fetching
    });
  // biome-ignore lint/correctness/useExhaustiveDependencies: Using stable serialized keys instead of array/object references to prevent infinite re-renders
  }, [
    dispatch,
    id,
    searchBoxId,
    searchValue,
    itemsPerPage,
    page,
    sort,
    fieldsKey,
    table,
    filterQueryKey,
    exclusionQueryKey,
    isSemanticEnabled,
    semanticIndexesKey,
    limit,
    customQuery,
    queryFromValue,
  ]);

  // Destroy widget from context (remove from the list to unapply its effects)
  useEffect(() => () => dispatch({ type: "deleteWidget", key: id }), [dispatch, id]);

  const defaultPagination = () => (
    <Pagination
      onChange={(p: number) => setPage(p)}
      total={total}
      itemsPerPage={itemsPerPage}
      page={page}
    />
  );

  return (
    <div className="react-af-results">
      {stats ? (
        stats(total)
      ) : isSemanticEnabled ? (
        <>
          {data.length} out of {total} results
        </>
      ) : (
        <>{total} results</>
      )}
      <div className="react-af-results-items">{items(data)}</div>
      {!isSemanticEnabled &&
        (pagination ? pagination(total, itemsPerPage, page, setPage) : defaultPagination())}
    </div>
  );
}
