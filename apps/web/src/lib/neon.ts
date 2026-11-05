import { createAuthClient } from '@neondatabase/auth';
const url = import.meta.env.VITE_NEON_AUTH_URL;
export const authClient = url ? createAuthClient(url) : null;

export async function workspaceRequest(path: string, init?: RequestInit, expectedUserId?: string) {
  if (!authClient) throw new Error('Sign-in is not configured yet.');
  const { data, error } = await authClient.getSession({ query: {} });
  const token = data?.session.token;
  if (expectedUserId && data?.user.id !== expectedUserId) {
    window.location.assign('/workspace');
    throw new Error('Your session changed. Reloading your workspace.');
  }
  if (error || !token) throw new Error('Please sign in again.');
  const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/workspace${path}`, {
    ...init,
    signal: init?.signal || AbortSignal.timeout(20000),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Check your report title and notes. Reports must contain text and stay under 10 KB.',
      401: 'Your session has expired. Please sign in again.',
      403: 'You do not have access to this action.',
      404: 'This report is no longer available.',
      409: 'You have reached the limit of 100 reports. Delete a report before saving another.',
      413: 'This report is too large. Keep it under 10 KB.',
      429: 'You have reached the request limit. Please try again in a minute.',
    };
    throw new Error(
      messages[response.status] || 'Your workspace is temporarily unavailable. Please try again.'
    );
  }
  return result;
}
