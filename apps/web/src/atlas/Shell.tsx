import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Map,
  BarChart3,
  Database,
  FolderClosed,
  BookOpen,
  Search,
  ArrowUpRight,
  ArrowRight,
  Menu,
  X,
  Command,
  ChevronRight,
} from 'lucide-react';
import { useCounties, useHealth } from './data';
import { Status } from './primitives';

const navigation = [
  { path: '/', label: 'Overview', icon: LayoutDashboard },
  { path: '/context', label: 'National context', icon: BarChart3 },
  { path: '/counties', label: 'County explorer', icon: Map },
  { path: '/market', label: 'Property market', icon: BarChart3 },
  { path: '/sources', label: 'Data sources', icon: Database },
];
const workspace = [
  { path: '/workspace', label: 'Your workspace', icon: FolderClosed },
  { path: '/api-docs', label: 'Developer API', icon: BookOpen },
];
export default function Shell() {
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState('');
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null),
    sidebar = useRef<HTMLElement>(null),
    main = useRef<HTMLDivElement>(null),
    location = useLocation(),
    navigate = useNavigate();
  const counties = useCounties(),
    health = useHealth();
  const current =
    [...navigation, ...workspace].find((item) => item.path === location.pathname)?.label || 'Atlas';
  const openSearch = () => {
    setSearch('');
    dialog.current?.showModal();
    requestAnimationFrame(() => input.current?.focus());
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    setMobile(false);
    window.scrollTo(0, 0);
    document.title = `${current} — Homara Atlas`;
  }, [location.pathname, current]);
  useEffect(() => {
    if (!mobile) return;
    const mainElement = main.current;
    if (mainElement) mainElement.inert = true;
    sidebar.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', escape);
    const desktop = window.matchMedia('(min-width: 701px)');
    const resize = () => {
      if (desktop.matches) setMobile(false);
    };
    desktop.addEventListener('change', resize);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      if (mainElement) mainElement.inert = false;
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', escape);
      desktop.removeEventListener('change', resize);
    };
  }, [mobile]);
  const go = (path: string) => {
    dialog.current?.close();
    navigate(path);
  };
  const matches = [...navigation, ...workspace].filter((item) =>
    item.label.toLowerCase().includes(search.toLowerCase())
  );
  const countyMatches =
    search.length > 1
      ? counties.data
          ?.filter((county) => county.name.toLowerCase().includes(search.toLowerCase()))
          .slice(0, 8) || []
      : [];
  return (
    <div className="atlas-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside ref={sidebar} className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <button
          className="icon-button sidebar-close"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <Link to="/" className="brand" aria-label="Homara Atlas overview">
          <img src="/brand/logo-mark-inverse.svg" alt="" />
          <span>
            homara<span className="brand-product">atlas</span>
          </span>
        </Link>
        <div className="sidebar-scope">
          <span className="country-identifier">KE</span>
          <div>
            Kenya<span>Research workspace</span>
          </div>
          <ChevronRight size={15} />
        </div>
        <p className="nav-caption">Explore</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === '/'}>
              <item.icon size={18} />
              <span>{item.label}</span>
              <span className="nav-active-dot" />
            </NavLink>
          ))}
        </nav>
        <p className="nav-caption workspace-caption">Workspace</p>
        <nav aria-label="Workspace navigation">
          {workspace.map((item) => (
            <NavLink key={item.path} to={item.path}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-label">Built on evidence</span>
            <p>
              Know the source.
              <br />
              Understand the context.
            </p>
            <Link to="/sources">
              View our data <ArrowUpRight size={15} />
            </Link>
          </div>
          <a href="https://homara.co.ke" target="_blank" rel="noreferrer" className="homara-link">
            Visit Homara <ArrowUpRight size={15} />
          </a>
          <div className="sidebar-status">
            <span />
            Atlas research edition <span className="version">01</span>
          </div>
        </div>
      </aside>
      <div ref={main} className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={21} />
            </button>
            <span className="breadcrumb-root">Atlas</span>
            <ChevronRight size={13} />
            <span>{current}</span>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={openSearch}>
              <Search size={15} />
              <span>Search Atlas</span>
              <kbd>
                <Command size={11} />K
              </kbd>
            </button>
            <span className="topbar-divider" />
            <Link className="account-button" to="/workspace" aria-label="Open your workspace">
              H
            </Link>
          </div>
        </header>
        <main id="main-content" className="page-content" key={location.pathname}>
          <Outlet />
        </main>
        <footer className="page-footer">
          <span>
            Homara Atlas <span className="footer-dot">/</span> Kenya, with context.
          </span>
          <Link to="/sources">
            <Status muted={health.data?.status !== 'current'}>
              {health.data?.status === 'current'
                ? 'Sources up to date'
                : health.isError
                  ? 'Source status unavailable'
                  : 'View source status'}
            </Status>
          </Link>
          <span>Times shown in East Africa Time</span>
        </footer>
      </div>
      <dialog
        ref={dialog}
        className="search-dialog"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
        aria-labelledby="search-title"
      >
        <div className="search-dialog-inner">
          <div className="search-input-row">
            <Search size={20} />
            <label className="sr-only" id="search-title" htmlFor="atlas-search">
              Search Atlas pages and counties
            </label>
            <input
              ref={input}
              id="atlas-search"
              placeholder="Search pages and counties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className="icon-button"
              aria-label="Close search"
              onClick={() => dialog.current?.close()}
            >
              <X size={18} />
            </button>
          </div>
          <div className="search-results">
            <p className="small-label">Pages</p>
            {matches.map((item) => (
              <button key={item.path} onClick={() => go(item.path)}>
                <item.icon size={18} />
                <span>{item.label}</span>
                <ArrowRight size={16} />
              </button>
            ))}
            {countyMatches.length > 0 && <p className="small-label">Counties</p>}
            {countyMatches.map((county) => (
              <button
                key={county.id}
                onClick={() => go(`/counties?county=${encodeURIComponent(county.name)}`)}
              >
                <Map size={18} />
                <span>{county.name}</span>
                <ArrowRight size={16} />
              </button>
            ))}
            {!matches.length && !countyMatches.length && (
              <p className="search-empty">No matches. Try a page name or county.</p>
            )}
          </div>
          <div className="search-hint">
            Use Tab to navigate <span>Esc to close</span>
          </div>
        </div>
      </dialog>
    </div>
  );
}
