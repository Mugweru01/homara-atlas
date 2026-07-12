import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PriceIndex from "./pages/PriceIndex";
import Neighbourhoods from "./pages/Neighbourhoods";
import Affordability from "./pages/Affordability";
import HeatMaps from "./pages/HeatMaps";
import DeveloperAPI from "./pages/DeveloperAPI";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          }>
            <ErrorBoundary>
              <Routes>
                <Route element={<DashboardLayout />}>
                  <Route path="/" element={<Index />} />
                  <Route path="/price-index" element={<PriceIndex />} />
                  <Route path="/neighbourhoods" element={<Neighbourhoods />} />
                  <Route path="/affordability" element={<Affordability />} />
                  <Route path="/heatmaps" element={<HeatMaps />} />
                  <Route path="/api-docs" element={<DeveloperAPI />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
