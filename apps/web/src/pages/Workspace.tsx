import { useCallback, useEffect, useState } from 'react';
import { createRealtimeClient } from '@neon/realtime/client';
import { authClient, workspaceRequest } from '@/lib/neon';

type Report = { id: string; title: string; created_at: Date | string };

export default function Workspace() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [register, setRegister] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [liveStatus, setLiveStatus] = useState('connecting');
  const request = useCallback(
    (path: string, init?: RequestInit) => workspaceRequest(path, init, user?.id),
    [user?.id]
  );

  useEffect(() => {
    if (!authClient) {
      setChecking(false);
      return;
    }
    authClient
      .getSession({ query: {} })
      .then(({ data, error }) => {
        if (error) setError(error.message || 'Could not restore your session.');
        setUser(data?.user || null);
      })
      .catch(() => setError('Could not connect to sign-in.'))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    let disposed = false;
    let close = () => {};
    let timer: ReturnType<typeof setInterval>;
    const start = async () => {
      setReports(await request('/reports'));
      if (!import.meta.env.VITE_NEON_REALTIME_URL) {
        setLiveStatus('unavailable');
        return;
      }
      const client = createRealtimeClient({ url: import.meta.env.VITE_NEON_REALTIME_URL });
      close = () => client.close();
      const sealed = await request('/reports/live', { method: 'POST' });
      if (disposed) {
        close();
        return;
      }
      const subscription = client.subscribe<Report>(sealed);
      subscription.onChange((snapshot) => {
        if (!disposed) setReports([...snapshot.data]);
      });
      subscription.onStateChange((state) => {
        if (!disposed) setLiveStatus(state.status);
      });
      timer = setInterval(async () => {
        try {
          const { data } = await authClient!.getSession({ query: {} });
          if (data?.user.id !== user.id) {
            window.location.assign('/workspace');
            return;
          }
          await subscription.renew(await request('/reports/live', { method: 'POST' }));
        } catch {
          clearInterval(timer);
          close();
          if (!disposed) setLiveStatus('error');
        }
      }, 30000);
    };
    start().catch((err) => {
      if (!disposed) {
        setError(err.message);
        setLiveStatus('error');
      }
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      close();
    };
  }, [user, request]);

  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const fields = { email: String(form.get('email')), password: String(form.get('password')) };
    try {
      const result = register
        ? await authClient!.signUp.email({ ...fields, name: String(form.get('name')) })
        : await authClient!.signIn.email(fields);
      if (result.error) throw new Error(result.error.message || 'Sign-in failed');
      const { data } = await authClient!.getSession({ query: {} });
      if (data?.user) window.location.assign('/workspace');
      else setError('Check your email to verify your account, then sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setPending(false);
    }
  }
  async function saveReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError('');
    try {
      await request('/reports', {
        method: 'POST',
        body: JSON.stringify({ title: form.get('title'), content: form.get('content') }),
      });
      setReports(await request('/reports'));
      formElement.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }
  const inputClass = 'block w-full rounded-lg border border-border p-3 bg-white';
  const buttonClass = 'rounded-lg bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50';
  if (checking) return <p>Restoring your session…</p>;
  if (!authClient) return <p>Workspace sign-in is awaiting service configuration.</p>;
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Your workspace</h1>
      {error && (
        <p role="alert" className="text-red-700 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}
      {!user ? (
        <form onSubmit={authenticate} className="space-y-4 max-w-md">
          <h2 className="text-xl">{register ? 'Create your account' : 'Sign in'}</h2>
          {register && (
            <label className="block">
              Name
              <input className={inputClass} name="name" required autoComplete="name" />
            </label>
          )}
          <label className="block">
            Email
            <input className={inputClass} name="email" type="email" required autoComplete="email" />
          </label>
          <label className="block">
            Password
            <input
              className={inputClass}
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={register ? 'new-password' : 'current-password'}
            />
          </label>
          <button disabled={pending} className={buttonClass}>
            {pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}
          </button>
          <button type="button" className="block underline" onClick={() => setRegister(!register)}>
            {register ? 'Already have an account? Sign in' : 'Create an account'}
          </button>
        </form>
      ) : (
        <>
          <div className="flex justify-between">
            <span>{user.email}</span>
            <button
              disabled={pending}
              className="underline"
              onClick={async () => {
                setPending(true);
                setError('');
                try {
                  const result = await authClient.signOut({});
                  if (result.error) throw new Error(result.error.message);
                  window.location.assign('/workspace');
                } catch {
                  setError('Could not sign out. Please retry.');
                  setPending(false);
                }
              }}
            >
              Sign out
            </button>
          </div>
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Private reports</h2>
            <p className="text-sm text-muted-foreground">
              Saved to your account. Live updates: {liveStatus}.
            </p>
            <ul className="divide-y">
              {reports.map((report) => (
                <li key={report.id} className="py-3 flex justify-between">
                  <span>{report.title}</span>
                  <button
                    className="underline"
                    onClick={async () => {
                      try {
                        const { url } = await request(`/reports/${report.id}`);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Download failed');
                      }
                    }}
                  >
                    Download
                  </button>
                </li>
              ))}
            </ul>
            {!reports.length && <p>No saved reports yet.</p>}
            <form onSubmit={saveReport} className="space-y-3">
              <label className="block">
                Report title
                <input className={inputClass} name="title" required maxLength={120} />
              </label>
              <label className="block">
                Report text
                <textarea
                  className={inputClass}
                  name="content"
                  required
                  maxLength={10000}
                  rows={5}
                />
              </label>
              <button className={buttonClass} disabled={pending}>
                {pending ? 'Saving…' : 'Save private report'}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
