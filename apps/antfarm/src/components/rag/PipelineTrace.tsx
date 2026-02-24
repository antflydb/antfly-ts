import { MessageSquare } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { PipelineDetailPanel } from "./PipelineDetailPanel";
import { PipelineGraph } from "./PipelineGraph";
import type { PipelineState } from "./pipeline-types";

interface PipelineTraceProps {
  pipeline: PipelineState;
  onFollowupClick?: (question: string) => void;
  formatAnswer?: (text: string) => React.ReactNode;
}

export const PipelineTrace: React.FC<PipelineTraceProps> = ({
  pipeline,
  onFollowupClick,
  formatAnswer,
}) => {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const handleSelectStep = useCallback((stepId: string) => {
    setSelectedStepId((prev) => (prev === stepId ? null : stepId));
  }, []);

  const selectedStep = useMemo(
    () => pipeline.steps.find((s) => s.id === selectedStepId) ?? null,
    [pipeline.steps, selectedStepId]
  );

  if (pipeline.overallStatus === "idle" || pipeline.steps.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Run a query to see the pipeline trace</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">Pipeline Trace</h3>
        {pipeline.overallStatus === "running" && (
          <span className="flex items-center gap-1.5 text-xs text-blue-500">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Running
          </span>
        )}
        {pipeline.overallStatus === "complete" && (
          <span className="text-xs text-green-500">Complete</span>
        )}
        {pipeline.overallStatus === "error" && <span className="text-xs text-red-500">Error</span>}
      </div>

      <PipelineGraph
        steps={pipeline.steps}
        selectedStepId={selectedStepId}
        onSelectStep={handleSelectStep}
      />

      <PipelineDetailPanel
        step={selectedStep}
        open={selectedStepId !== null}
        onFollowupClick={onFollowupClick}
        formatAnswer={formatAnswer}
      />
    </div>
  );
};
