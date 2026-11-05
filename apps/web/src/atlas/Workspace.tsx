import { useCallback, useEffect, useState } from 'react';
import { createRealtimeClient } from '@neon/realtime/client';
import {
  ArrowRight,
  LockKeyhole,
  FileText,
  Download,
  Trash2,
  Plus,
  X,
  LogOut,
  FolderOpen,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { authClient, workspaceRequest } from '@/lib/neon';
import { PageHeading, Status, Loading, ErrorState } from './primitives';
import { date } from './data';

type Report = { id: string; title: string; created_at: Date | string };
export default function Workspace() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null),
    [checking, setChecking] = useState(true),
    [register, setRegister] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [reports, setReports] = useState<Report[]>([]),
    [liveStatus, setLiveStatus] = useState('connecting'),
    [compose, setCompose] = useState(false),
    [confirm, setConfirm] = useState(''),
    [notice, setNotice] = useState(''),
    [showPassword, setShowPassword] = useState(false),
    [retry, setRetry] = useState(0);
  const request = useCallback(
    (path: string, init?: RequestInit) => workspaceRequest(path, init, user?.id),
    [user?.id]
  );
  useEffect(() => {
    let active = true;
    if (!authClient) {
      setChecking(false);
      return;
    }
    authClient
      .getSession({ query: {} })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message || 'Could not restore your session.');
        setUser(data?.user || null);
      })
      .catch(() => {
        if (active) setError('Could not connect to sign-in.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let disposed = false,
      close = () => {};
    let timer: ReturnType<typeof setInterval>;
    async function start() {
      const list = await request('/reports');
      if (disposed) return;
      setReports(list);
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
      let renewing = false;
      timer = setInterval(async () => {
        if (renewing) return;
        renewing = true;
        try {
          await subscription.renew(await request('/reports/live', { method: 'POST' }));
        } catch {
          clearInterval(timer);
          close();
          if (!disposed) setLiveStatus('error');
        } finally {
          renewing = false;
        }
      }, 30000);
    }
    start().catch((err) => {
      if (!disposed) {
        setError(err instanceof Error ? err.message : 'Reports could not be loaded.');
        setLiveStatus('error');
      }
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      close();
    };
  }, [user, request, retry]);
  async function authenticate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget),
      fields = { email: String(form.get('email')).trim(), password: String(form.get('password')) };
    try {
      const result = register
        ? await authClient!.signUp.email({ ...fields, name: String(form.get('name')).trim() })
        : await authClient!.signIn.email(fields);
      if (result.error) throw new Error(result.error.message || 'Sign-in failed.');
      const { data } = await authClient!.getSession({ query: {} });
      if (data?.user) {
        setUser(data.user);
        setNotice('You are signed in.');
      } else setNotice('Check your email to verify your account, then sign in.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setPending(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await request('/reports', {
        method: 'POST',
        body: JSON.stringify({
          title: String(form.get('title')).trim(),
          content: String(form.get('content')).trim(),
        }),
      });
      setReports(await request('/reports'));
      setCompose(false);
      setNotice('Your report was saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The report could not be saved.');
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    setPending(true);
    setError('');
    try {
      await request(`/reports/${id}`, { method: 'DELETE' });
      setReports((items) => items.filter((item) => item.id !== id));
      setConfirm('');
      setNotice('Your report was deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setPending(false);
    }
  }
  async function download(id: string) {
    setError('');
    try {
      const { url } = await request(`/reports/${id}`);
      const target = new URL(url);
      if (target.protocol !== 'https:') throw new Error('The download URL is invalid.');
      window.location.assign(target.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    }
  }
  if (checking) return <Loading label="Restoring your workspace" />;
  return (
    <>
      <PageHeading
        eyebrow="Your workspace"
        title={user ? 'Your research workspace' : 'Your private workspace'}
        description={
          user
            ? 'Write, save and download private reports across your devices.'
            : 'Sign in to keep your reports in one private, connected workspace.'
        }
      >
        {user && (
          <button
            className="button primary"
            onClick={() => {
              setCompose(!compose);
              setError('');
            }}
          >
            <Plus size={16} />
            New report
          </button>
        )}
      </PageHeading>
      {error && (
        <ErrorState
          title="We could not complete that action"
          message={error}
          retry={
            user
              ? () => {
                  setError('');
                  setRetry((n) => n + 1);
                }
              : undefined
          }
        />
      )}
      {notice && (
        <div className="success-notice" role="status">
          <Check size={16} />
          {notice}
          <button
            aria-label="Dismiss notification"
            className="icon-button"
            onClick={() => setNotice('')}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {!user ? (
        <div className="auth-layout">
          <section className="auth-story">
            <img src="/brand/logo-mark-inverse.svg" alt="" />
            <span className="small-label">Your Atlas workspace</span>
            <h2>
              A place for
              <br />
              what you discover.
            </h2>
            <p>Keep your notes and reports connected to the context that matters.</p>
            <div className="auth-benefits">
              <span>
                <FileText size={18} />
                Private research reports
              </span>
              <span>
                <LockKeyhole size={18} />
                Access limited to your account
              </span>
              <span>
                <FolderOpen size={18} />
                Available across your devices
              </span>
            </div>
            <div className="auth-story-footer">
              homara <span>/ atlas</span>
            </div>
          </section>
          <section className="auth-form-panel">
            <span className="small-label">{register ? 'Get started' : 'Welcome back'}</span>
            <h2>{register ? 'Create your account' : 'Sign in to Atlas'}</h2>
            <p>
              {register
                ? 'Start your private research workspace.'
                : 'Pick up where your research left off.'}
            </p>
            {!authClient ? (
              <ErrorState message="Sign-in has not been configured for this deployment." />
            ) : (
              <form onSubmit={authenticate} className="atlas-form">
                {register && (
                  <label>
                    Your name
                    <input name="name" autoComplete="name" required maxLength={100} />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    required
                    maxLength={254}
                  />
                </label>
                <label>
                  Password
                  <span className="password-field">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      minLength={8}
                      maxLength={128}
                      autoComplete={register ? 'new-password' : 'current-password'}
                      required
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                <button className="button primary" disabled={pending}>
                  {pending ? 'Please wait...' : register ? 'Create account' : 'Sign in'}
                  <ArrowRight size={16} />
                </button>
                <p className="auth-switch">
                  {register ? 'Already have an account?' : 'New to Atlas?'}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setRegister(!register);
                      setError('');
                    }}
                  >
                    {register ? 'Sign in' : 'Create an account'}
                  </button>
                </p>
              </form>
            )}
            <p className="auth-security">
              <LockKeyhole size={13} />
              Your reports are private to your account.
            </p>
          </section>
        </div>
      ) : (
        <>
          <div className="workspace-account">
            <span className="account-avatar">{user.email?.slice(0, 1).toUpperCase() || 'H'}</span>
            <div>
              <strong>{user.email}</strong>
              <span>Private research workspace</span>
            </div>
            <Status muted={liveStatus !== 'live'}>
              {liveStatus === 'live'
                ? 'Live updates connected'
                : liveStatus === 'error'
                  ? 'Live updates interrupted'
                  : 'Connecting live updates'}
            </Status>
            <button
              className="button secondary"
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  const result = await authClient!.signOut({});
                  if (result.error) throw new Error();
                  setUser(null);
                  setReports([]);
                  setCompose(false);
                  setNotice('You are signed out.');
                } catch {
                  setError('Could not sign out. Please retry.');
                } finally {
                  setPending(false);
                }
              }}
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
          {compose && (
            <section className="report-composer">
              <div className="section-heading">
                <h2>New private report</h2>
                <button
                  className="icon-button"
                  aria-label="Close report editor"
                  disabled={pending}
                  onClick={() => setCompose(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <form onSubmit={save} className="atlas-form">
                <label>
                  Report title
                  <input
                    name="title"
                    placeholder="Give your research a useful title"
                    required
                    maxLength={120}
                  />
                </label>
                <label>
                  Your notes
                  <textarea
                    name="content"
                    placeholder="Record your observations, sources and next steps..."
                    required
                    maxLength={10000}
                    rows={8}
                  />
                </label>
                <p className="muted">Plain text · Up to 10 KB of text · Private to your account</p>
                <button className="button primary" disabled={pending}>
                  {pending ? 'Saving report...' : 'Save report'}
                  <ArrowRight size={16} />
                </button>
              </form>
            </section>
          )}
          <section className="reports-section">
            <div className="section-heading">
              <h2>
                Saved reports <span className="count-label">{reports.length}</span>
              </h2>
              <span className="muted">Up to 100 reports</span>
            </div>
            {!reports.length ? (
              <div className="reports-empty">
                <FolderOpen size={35} strokeWidth={1.3} />
                <h3>Your first report starts here.</h3>
                <p>Save a note, a research summary or questions to investigate.</p>
                <button className="text-link" onClick={() => setCompose(true)}>
                  Write a report <Plus size={15} />
                </button>
              </div>
            ) : (
              <ul className="report-list">
                {reports.map((report) => (
                  <li key={report.id}>
                    <span className="dataset-icon">
                      <FileText size={20} />
                    </span>
                    <div>
                      <h3>{report.title}</h3>
                      <span>{date(String(report.created_at))}</span>
                    </div>
                    {confirm === report.id ? (
                      <div className="delete-confirm">
                        <span>Delete this report?</span>
                        <button
                          className="button danger"
                          disabled={pending}
                          onClick={() => void remove(report.id)}
                        >
                          Delete
                        </button>
                        <button
                          className="button secondary"
                          disabled={pending}
                          onClick={() => setConfirm('')}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="report-actions">
                        <button
                          className="button secondary"
                          onClick={() => void download(report.id)}
                        >
                          <Download size={15} />
                          Download
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Delete ${report.title}`}
                          onClick={() => setConfirm(report.id)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}
