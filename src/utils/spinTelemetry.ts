import { SpinTelemetryLog } from '../types';

/**
 * Logs a spin event for telemetry and analytics.
 * In a real app, this would send data to a service like Segment, Mixpanel, or a custom backend.
 */
export function logSpin(log: SpinTelemetryLog): void {
  console.log("SPIN TELEMETRY:", log);
  // Example of sending to an analytics service:
  // analytics.track('Wheel Spun', log);
}
