import { captureError } from "@/server/observability/error-monitor";

export function register() {}

export function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: Record<string, string> },
  context: { routePath: string; routeType: string },
) {
  void captureError(error, {
    method: request.method,
    path: request.path,
    routePath: context.routePath,
    routeType: context.routeType,
  });
}
