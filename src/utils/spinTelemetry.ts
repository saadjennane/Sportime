import { SpinTelemetryLog } from '../types';

// This is a mock telemetry service. In a real app, this would send data to an analytics platform.
export const spinTelemetry = {
  logSpin: (log: SpinTelemetryLog) => {
    console.log('[SPIN TELEMETRY]', log);
  },
};
