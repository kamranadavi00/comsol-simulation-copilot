import type {
  AIAction,
  AIVerifiedResult,
  AIVisualizationContext,
} from "./schema";
import { executeDatasetAction } from "@/lib/api/datasets";
import { formatNumber } from "@/lib/visualization";
import type {
  ExtremeResult,
  FilterResult,
  NearestPointResult,
  ProfileResult,
  StatisticsResult,
  Threshold,
} from "@/types/datasets";

export interface AIActionExecutorContext {
  datasetId: string;
  visualization: AIVisualizationContext;
  changeField: (field: string) => Promise<void>;
  applyThreshold: (threshold: Threshold) => Promise<FilterResult>;
  createProfile: (axis: "x" | "y" | "z", field: string) => Promise<ProfileResult>;
  focusLocation: (location: { x: number; y: number; z?: number }) => Promise<NearestPointResult>;
  loadStatistics: (field: string) => Promise<StatisticsResult>;
  resetView: () => void;
  setNotice: (message: string) => void;
}

export interface AIActionExecution {
  verifiedResults: AIVerifiedResult[];
  visualization: AIVisualizationContext;
}

export async function executeAIActions(
  actions: AIAction[],
  context: AIActionExecutorContext,
): Promise<AIActionExecution> {
  const verifiedResults: AIVerifiedResult[] = [];
  let visualization = { ...context.visualization };

  for (const action of actions) {
    if (action.type === "change_field") {
      await context.changeField(action.field);
      visualization = {
        ...visualization,
        activeField: action.field,
        threshold: null,
        selectedLocation: null,
      };
      continue;
    }

    if (action.type === "set_threshold") {
      const result = await context.applyThreshold(action);
      verifiedResults.push({
        action: "filter",
        field: action.field,
        operator: action.operator,
        value: action.value,
        matchedCount: result.matchedCount,
      });
      visualization = { ...visualization, threshold: action };
      continue;
    }

    if (action.type === "reset_view") {
      context.resetView();
      visualization = { ...visualization, threshold: null, selectedLocation: null };
      continue;
    }

    if (action.type === "focus_point") {
      const result = await context.focusLocation(action);
      verifiedResults.push(result);
      visualization = { ...visualization, selectedLocation: result.location };
      continue;
    }

    if (action.type === "create_profile") {
      const result = await context.createProfile(action.axis, action.field);
      verifiedResults.push({
        action: "profile",
        field: result.field,
        axis: result.axis,
        pointCount: result.points.length,
      });
      continue;
    }

    if (action.type === "statistics") {
      const result = await context.loadStatistics(action.field);
      verifiedResults.push(result);
      continue;
    }

    const result = await executeDatasetAction<ExtremeResult>(
      context.datasetId,
      action.type,
      { field: action.field },
    );
    verifiedResults.push(result);
    await context.focusLocation(result.location);
    visualization = { ...visualization, selectedLocation: result.location };
    context.setNotice(
      `${action.field} ${action.type === "find_max" ? "maximum" : "minimum"}: ${formatNumber(result.value)} at row ${result.rowIndex}.`,
    );
  }

  return { verifiedResults, visualization };
}
