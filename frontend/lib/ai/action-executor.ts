import { verifiedExtremeResultSchema } from "./schema";
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
  highlightRegion: (threshold: Threshold) => Promise<FilterResult>;
  highlightPoints: (rowIndexes: number[]) => void;
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
        highlightedRegion: null,
        selectedLocation: null,
      };
      continue;
    }

    if (action.type === "filter") {
      const result = await context.highlightRegion(action);
      verifiedResults.push({
        action: "filter",
        field: action.field,
        operator: action.operator,
        value: action.value,
        matchedCount: result.matchedCount,
        rowIndexes: result.rowIndexes,
      });
      visualization = {
        ...visualization,
        threshold: null,
        highlightedRegion: {
          field: action.field,
          operator: action.operator,
          value: action.value,
          matchedCount: result.matchedCount,
        },
      };
      continue;
    }

    if (action.type === "highlight_points") {
      context.highlightPoints(action.rowIndexes);
      continue;
    }

    if (action.type === "reset_view") {
      context.resetView();
      visualization = {
        ...visualization,
        threshold: null,
        highlightedRegion: null,
        selectedLocation: null,
      };
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

    const result = verifiedExtremeResultSchema.parse(
      await executeDatasetAction<ExtremeResult>(
        context.datasetId,
        action.type,
        { field: action.field },
      ),
    );
    if (visualization.activeField !== action.field) {
      await context.changeField(action.field);
      visualization = {
        ...visualization,
        activeField: action.field,
        threshold: null,
        highlightedRegion: null,
        selectedLocation: null,
      };
    }
    verifiedResults.push(result);
    await context.focusLocation(result.location);
    visualization = { ...visualization, selectedLocation: result.location };
    context.setNotice(
      `${action.field} ${action.type === "find_max" ? "maximum" : "minimum"}: ${formatNumber(result.value)} at row ${result.rowIndex}.`,
    );
  }

  return { verifiedResults, visualization };
}

function exactLocation(location: { x: number; y: number; z?: number }): string {
  return [
    `x = ${String(location.x)}`,
    `y = ${String(location.y)}`,
    ...(location.z === undefined ? [] : [`z = ${String(location.z)}`]),
  ].join(", ");
}

export function formatVerifiedResults(results: AIVerifiedResult[]): string {
  return results
    .map((result) => {
      if (result.action === "find_max" || result.action === "find_min") {
        const label = result.action === "find_max" ? "Maximum" : "Minimum";
        return `${label} ${result.field}: ${String(result.value)}\nLocation: ${exactLocation(result.location)}\nRow: ${result.rowIndex}`;
      }
      if (result.action === "statistics") {
        return [
          `${result.field} statistics (${result.count} values)`,
          `Minimum: ${String(result.min)}`,
          `Maximum: ${String(result.max)}`,
          `Mean: ${String(result.mean)}`,
          `Median: ${String(result.median)}`,
          `Standard deviation: ${String(result.standardDeviation)}`,
        ].join("\n");
      }
      if (result.action === "filter") {
        return `${result.matchedCount} rows match ${result.field} ${result.operator} ${String(result.value)}. Verified matches are highlighted in the viewer.`;
      }
      if (result.action === "profile") {
        return `Created a verified ${result.pointCount}-point ${result.field} profile along ${result.axis.toUpperCase()}.`;
      }
      return `Focused verified row ${result.rowIndex}.\nLocation: ${exactLocation(result.location)}`;
    })
    .join("\n\n");
}
