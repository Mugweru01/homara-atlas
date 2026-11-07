import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Shell from './atlas/Shell';
import Overview from './atlas/Overview';
import { Loading } from './atlas/primitives';
import { ErrorBoundary } from './components/ErrorBoundary';
const Context = lazy(() => import('./atlas/Context'));
const Counties = lazy(() => import('./atlas/Counties'));
const Market = lazy(() => import('./atlas/Market'));
const Sources = lazy(() => import('./atlas/Sources'));
const Workspace = lazy(() => import('./atlas/Workspace'));
const Developer = lazy(() => import('./atlas/Developer'));
const Locations = lazy(() => import('./atlas/Locations'));
const Listings = lazy(() => import('./atlas/Listings'));
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false } },
});
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<Loading label="Opening Atlas" />}>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<Overview />} />
                <Route path="context" element={<Context />} />
                <Route path="counties" element={<Counties />} />
                <Route path="locations" element={<Locations />} />
                <Route path="listings" element={<Listings />} />
                <Route path="market" element={<Market />} />
                <Route path="sources" element={<Sources />} />
                <Route path="workspace" element={<Workspace />} />
                <Route path="api-docs" element={<Developer />} />
                <Route path="heatmaps" element={<Navigate to="/counties" replace />} />
                <Route path="neighbourhoods" element={<Navigate to="/counties" replace />} />
                <Route path="price-index" element={<Navigate to="/market" replace />} />
                <Route path="affordability" element={<Navigate to="/context" replace />} />
                <Route
                  path="*"
                  element={
                    <div className="not-found">
                      <p className="eyebrow">Page not found</p>
                      <h1>Let’s find your way back.</h1>
                      <p>This page does not exist in the Atlas.</p>
                      <Link className="button primary" to="/">
                        Return to overview
                      </Link>
                    </div>
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
