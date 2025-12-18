import type { bleve_components, components } from "@antfly/sdk";
import { Cross2Icon, PlusIcon, TrashIcon } from "@radix-ui/react-icons";
import type React from "react";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BasicField, SearchableField } from "../../utils/fieldUtils";
import FieldSelector from "./FieldSelector";
import QueryNode from "./QueryNode";

type Query = bleve_components["schemas"]["Query"];
type QueryRequest = components["schemas"]["QueryRequest"];

interface QueryBuilderProps {
  value: string;
  onChange: (value: string) => void;
  showQueryNode?: boolean;
  showOrderByAndFacets?: boolean;
  showLimitAndOffset?: boolean;
  disableOffset?: boolean;
  availableFields?: SearchableField[];
  availableBasicFields?: BasicField[];
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({
  value,
  onChange,
  showQueryNode = true,
  showOrderByAndFacets = true,
  showLimitAndOffset = false,
  disableOffset = false,
  availableFields = [],
  availableBasicFields = [],
}) => {
  const [newFacetName, setNewFacetName] = useState("");
  const [newFacetField, setNewFacetField] = useState("");
  let queryRequest: QueryRequest;
  try {
    const parsed = JSON.parse(value);
    if (showQueryNode && !showOrderByAndFacets) {
      // For filter queries, the value is just the query object
      queryRequest = { filter_query: parsed };
    } else {
      // For semantic queries, the value is the full query request
      queryRequest = parsed;
    }
  } catch (e) {
    console.error("Failed to parse query JSON:", e);
    // Provide a default valid query if parsing fails
    if (showQueryNode && !showOrderByAndFacets) {
      queryRequest = { filter_query: { match_all: {} } };
    } else {
      queryRequest = { filter_query: { match_all: {} } };
    }
  }

  const handleQueryChange = (newQuery: Query) => {
    if (showQueryNode && !showOrderByAndFacets) {
      // For filter queries, just return the query itself
      onChange(JSON.stringify(newQuery, null, 2));
    } else {
      // For semantic queries, wrap in query request structure
      const newQueryRequest = { ...queryRequest, filter_query: newQuery };
      onChange(JSON.stringify(newQueryRequest, null, 2));
    }
  };

  const handleLimitChange = (limit: number) => {
    const newQueryRequest = { ...queryRequest, limit };
    onChange(JSON.stringify(newQueryRequest, null, 2));
  };

  const handleOffsetChange = (offset: number) => {
    const newQueryRequest = { ...queryRequest, offset };
    onChange(JSON.stringify(newQueryRequest, null, 2));
  };

  const handleOrderByChange = (index: number, field: string, asc: boolean) => {
    const newOrderBy = { ...queryRequest.order_by };
    const oldField = Object.keys(newOrderBy)[index];
    delete newOrderBy[oldField];
    newOrderBy[field] = asc;
    const newQueryRequest = { ...queryRequest, order_by: newOrderBy };
    onChange(JSON.stringify(newQueryRequest, null, 2));
  };

  const addOrderBy = () => {
    const newOrderBy = { ...queryRequest.order_by, "": true };
    const newQueryRequest = { ...queryRequest, order_by: newOrderBy };
    onChange(JSON.stringify(newQueryRequest, null, 2));
  };

  const removeOrderBy = (field: string) => {
    const newOrderBy = { ...queryRequest.order_by };
    delete newOrderBy[field];
    const newQueryRequest = { ...queryRequest, order_by: newOrderBy };
    onChange(JSON.stringify(newQueryRequest, null, 2));
  };

  const addFacet = () => {
    if (newFacetName && newFacetField) {
      const newFacets = {
        ...queryRequest.facets,
        [newFacetName]: { field: newFacetField, size: 5 },
      };
      const newQueryRequest = { ...queryRequest, facets: newFacets };
      onChange(JSON.stringify(newQueryRequest, null, 2));
      setNewFacetName("");
      setNewFacetField("");
    }
  };

  const removeFacet = (name: string) => {
    const newFacets = { ...queryRequest.facets };
    delete newFacets[name];
    const newQueryRequest = { ...queryRequest, facets: newFacets };
    onChange(JSON.stringify(newQueryRequest, null, 2));
  };

  return (
    <div>
      {showQueryNode && (
        <QueryNode
          query={(queryRequest.filter_query || { match_all: {} }) as Query}
          onChange={handleQueryChange}
          availableFields={availableFields}
        />
      )}
      {showLimitAndOffset && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">Limit</Label>
            <Input
              placeholder="Limit"
              type="number"
              value={queryRequest.limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
              className="h-9"
            />
          </div>
          {showOrderByAndFacets && (
            <div className="flex-1">
              <Label className="text-xs mb-1 block">Offset</Label>
              <Input
                placeholder={disableOffset ? "Disabled" : "Offset"}
                type="number"
                value={queryRequest.offset ?? ""}
                onChange={(e) =>
                  handleOffsetChange(e.target.value === "" ? 0 : parseInt(e.target.value, 10))
                }
                disabled={disableOffset}
                className="h-9"
              />
            </div>
          )}
        </div>
      )}
      {showOrderByAndFacets && (
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="orderby" className="border rounded-lg bg-card/50 px-3">
            <AccordionTrigger className="py-2.5 hover:no-underline">
              <span className="font-medium text-sm">Order By</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-1 space-y-2">
              {queryRequest.order_by &&
                Object.entries(queryRequest.order_by).map(([field, asc], index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted/30 rounded border"
                  >
                    <Input
                      placeholder="Field name"
                      value={field}
                      onChange={(e) => handleOrderByChange(index, e.target.value, asc)}
                      className="h-8"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs">{asc ? "Asc" : "Desc"}</span>
                      <Switch
                        checked={asc}
                        onCheckedChange={(checked) => handleOrderByChange(index, field, checked)}
                      />
                    </div>
                    <Button
                      onClick={() => removeOrderBy(field)}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                    >
                      <Cross2Icon className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              <Button onClick={addOrderBy} variant="outline" size="sm" className="h-8 w-full">
                <PlusIcon className="h-3 w-3 mr-1" />
                Add Order By
              </Button>
              <FieldSelector
                availableFields={availableBasicFields}
                onFieldSelect={(fieldName) => {
                  const newOrderBy = {
                    ...queryRequest.order_by,
                    [fieldName]: true,
                  };
                  onChange(JSON.stringify({ ...queryRequest, order_by: newOrderBy }, null, 2));
                }}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="facets" className="border rounded-lg bg-card/50 px-3">
            <AccordionTrigger className="py-2.5 hover:no-underline">
              <span className="font-medium text-sm">Facets</span>
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-1 space-y-2">
              {queryRequest.facets &&
                Object.entries(queryRequest.facets).map(([name, facet]) => (
                  <div
                    key={name}
                    className="flex items-start justify-between p-2 bg-muted/30 rounded border"
                  >
                    <div>
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        <code className="bg-muted px-1 py-0.5 rounded">
                          {facet.field || "none"}
                        </code>
                        {" • "}
                        Size: {facet.size || 5}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFacet(name)}
                      className="h-7 w-7 p-0"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  </div>
                ))}

              <div className="border-t pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs mb-1 block">Title</Label>
                    <Input
                      placeholder="e.g., Categories"
                      value={newFacetName}
                      onChange={(e) => setNewFacetName(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Field</Label>
                    <Input
                      placeholder="e.g., category"
                      value={newFacetField}
                      onChange={(e) => setNewFacetField(e.target.value)}
                      className="h-8"
                    />
                  </div>
                </div>
                <Button onClick={addFacet} className="w-full h-8" size="sm">
                  <PlusIcon className="h-3 w-3 mr-1" />
                  Add Facet
                </Button>
                <FieldSelector
                  availableFields={availableFields}
                  onFieldSelect={(field) => setNewFacetField(field)}
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default QueryBuilder;
