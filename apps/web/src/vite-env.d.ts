/// <reference types="vite/client" />

interface Window {
  Sentry?: {
    captureException(error: unknown, context?: unknown): void;
    captureMessage(message: string, level?: string): void;
  };
}
