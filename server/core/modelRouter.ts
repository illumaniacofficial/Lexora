import type {
  AgentTaskRequest,
  ModelRuntimeDescriptor,
  RuntimeAvailability,
} from "./runtime";
import { canRunInLocation } from "./runtime";

export interface RouteDecision {
  runtime: ModelRuntimeDescriptor | null;
  queueForOnline: boolean;
  reason: string;
}

const COST_RANK: Record<NonNullable<ModelRuntimeDescriptor["estimatedCostClass"]>, number> = {
  free: 0,
  low: 1,
  standard: 2,
  premium: 3,
};

function scoreRuntime(runtime: ModelRuntimeDescriptor, request: AgentTaskRequest): number {
  let score = 0;

  if (request.runtimeMode === "off-grid" && runtime.location === "local") score += 100;
  if (request.runtimeMode === "hybrid" && runtime.location === "local") score += 30;
  if (request.runtimeMode === "connected" && runtime.location === "cloud") score += 10;

  score += request.requiredCapabilities.reduce(
    (sum, capability) => sum + (runtime.capabilities.includes(capability) ? 5 : 0),
    0,
  );

  const cost = runtime.estimatedCostClass || "standard";
  score -= COST_RANK[cost] * 2;

  if (runtime.maxContextTokens) {
    score += Math.min(10, Math.floor(runtime.maxContextTokens / 32_000));
  }

  return score;
}

export function routeAgentTask(
  request: AgentTaskRequest,
  availability: RuntimeAvailability,
): RouteDecision {
  const candidates = [...availability.local, ...availability.cloud]
    .filter((runtime) => canRunInLocation(request, runtime))
    .sort((a, b) => scoreRuntime(b, request) - scoreRuntime(a, request));

  if (candidates[0]) {
    return {
      runtime: candidates[0],
      queueForOnline: false,
      reason: `Selected ${candidates[0].location} runtime ${candidates[0].id}`,
    };
  }

  const cloudCouldHandle = availability.cloud.some((runtime) =>
    request.requiredCapabilities.every((capability) =>
      runtime.capabilities.includes(capability),
    ),
  );

  if (
    !availability.online &&
    request.allowQueueWhenOffline &&
    request.allowCloud &&
    cloudCouldHandle
  ) {
    return {
      runtime: null,
      queueForOnline: true,
      reason: "No eligible local runtime; cloud-capable task queued until connection returns.",
    };
  }

  return {
    runtime: null,
    queueForOnline: false,
    reason: "No available runtime satisfies this task's capability and privacy requirements.",
  };
}
