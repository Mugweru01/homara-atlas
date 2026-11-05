import type { ReactNode } from 'react';
import { ArrowUpRight, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Status({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span className={`status ${muted ? 'status-muted' : ''}`}>
      <span />
      {children}
    </span>
  );
}
export function SectionTitle({
  title,
  detail,
  to,
}: {
  title: string;
  detail?: string;
  to?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {to && (
        <Link className="text-link" to={to}>
          Explore <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}
export function ErrorState({
  message,
  retry,
  title = 'Data is temporarily unavailable',
}: {
  message: string;
  retry?: () => void;
  title?: string;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {retry && (
        <button className="button secondary" onClick={retry}>
          <RefreshCw size={15} />
          Retry
        </button>
      )}
    </div>
  );
}
export function Loading({ label = 'Loading data' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loader" />
      {label}
    </div>
  );
}
export function ExportButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="button secondary" onClick={onClick} disabled={disabled}>
      <Download size={16} />
      Export data
    </button>
  );
}
export function Provenance({ children }: { children: ReactNode }) {
  return <p className="provenance">{children}</p>;
}
