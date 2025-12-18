import type { QueryHit } from "@antfly/sdk";
import { ChevronDown, ChevronRight, Star } from "lucide-react";
import type React from "react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import FieldValueDisplay from "./FieldValueDisplay";

interface QueryResultItemProps {
  hit: QueryHit;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  visibleFields?: Set<string>;
  previewFields?: string[];
}

const QueryResultItem: React.FC<QueryResultItemProps> = ({
  hit,
  index,
  isExpanded,
  onToggle,
  visibleFields,
  previewFields = ["title", "name", "description", "text", "content"],
}) => {
  const { _id, _source, _score } = hit;

  // Calculate score display
  const scoreDisplay = useMemo(() => {
    if (typeof _score !== "number") return null;

    const percentage = Math.min(100, Math.max(0, _score * 100));
    const stars = Math.round(_score * 5);

    return {
      percentage,
      stars,
      value: _score.toFixed(4),
    };
  }, [_score]);

  // Get preview field values
  const previewData = useMemo(() => {
    if (!_source) return [];

    const fields = previewFields
      .filter((field) => _source[field] !== undefined && _source[field] !== null)
      .slice(0, 3);

    return fields.map((field) => ({
      name: field,
      value: _source[field],
    }));
  }, [_source, previewFields]);

  // Get all fields for expanded view
  const allFields = useMemo(() => {
    if (!_source) return [];

    return Object.entries(_source)
      .filter(([key]) => !visibleFields || visibleFields.has(key))
      .sort(([a], [b]) => {
        // Sort special fields first
        const aSpecial = ["_id", "title", "name", "description"].includes(a);
        const bSpecial = ["_id", "title", "name", "description"].includes(b);
        if (aSpecial && !bSpecial) return -1;
        if (!aSpecial && bSpecial) return 1;
        return a.localeCompare(b);
      });
  }, [_source, visibleFields]);

  // Get preview text
  const previewText = useMemo(() => {
    if (previewData.length === 0) return "No preview available";

    const firstField = previewData[0];
    const value = firstField.value;

    if (typeof value === "string") {
      return value.length > 100 ? `${value.substring(0, 100)}...` : value;
    }

    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }

    if (typeof value === "object" && value !== null) {
      return `{${Object.keys(value).length} fields}`;
    }

    return String(value);
  }, [previewData]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggle}
      className="border rounded-lg bg-card hover:bg-accent/50 transition-colors"
    >
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full h-auto p-4 hover:bg-transparent justify-start">
          <div className="flex items-start gap-3 w-full text-left">
            {/* Expand/Collapse Icon */}
            <div className="shrink-0 mt-0.5">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Header: ID and Score */}
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {_id || `Result #${index + 1}`}
                </code>

                {scoreDisplay && (
                  <>
                    <Badge variant="outline" className="gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {scoreDisplay.value}
                    </Badge>

                    {/* Visual score bar */}
                    <div className="hidden sm:flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-3 w-3 ${
                            star <= scoreDisplay.stars
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Preview Text */}
              {!isExpanded && (
                <p className="text-sm text-muted-foreground line-clamp-2">{previewText}</p>
              )}
            </div>
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        <div className="pl-7 space-y-3 mt-2">
          {/* Score Details */}
          {scoreDisplay && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground min-w-24">Relevance:</span>
              <div className="flex-1 max-w-md">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 transition-all"
                      style={{ width: `${scoreDisplay.percentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground min-w-12">
                    {scoreDisplay.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t" />

          {/* All Fields */}
          <div className="space-y-3">
            {allFields.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No fields to display</p>
            ) : (
              allFields.map(([fieldName, fieldValue]) => (
                <div key={fieldName} className="grid grid-cols-12 gap-3 items-start">
                  <div className="col-span-12 sm:col-span-3">
                    <span className="text-xs font-medium text-muted-foreground break-words">
                      {fieldName}
                    </span>
                  </div>
                  <div className="col-span-12 sm:col-span-9">
                    <FieldValueDisplay value={fieldValue} fieldName={fieldName} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default QueryResultItem;
