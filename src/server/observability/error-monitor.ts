import { log, type LogFields } from "@/server/observability/logger";

export interface ErrorMonitoringAdapter {
  capture(error: unknown, context?: LogFields): void | Promise<void>;
}

class StructuredLogErrorMonitor implements ErrorMonitoringAdapter {
  capture(error: unknown, context: LogFields = {}) {
    log("error", "application.error", { ...context, error });
  }
}

let adapter: ErrorMonitoringAdapter = new StructuredLogErrorMonitor();

export function configureErrorMonitoring(next: ErrorMonitoringAdapter): void {
  adapter = next;
}

export function captureError(error: unknown, context: LogFields = {}) {
  return adapter.capture(error, context);
}
