import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Zap, AlertTriangle, Check, X, Clock, TrendingUp, TrendingDown,
  Activity, Globe, Database, Code
} from 'lucide-react';
import { toast } from 'sonner';

interface PerformanceSummary {
  category: string;
  metric_name: string;
  avg_value: number;
  min_value: number;
  max_value: number;
  p50_value: number;
  p95_value: number;
  p99_value: number;
  sample_count: number;
}

interface EndpointPerformance {
  endpoint: string;
  method: string;
  avg_response_time: number;
  max_response_time: number;
  total_requests: number;
  error_count: number;
  error_rate: number;
  avg_status_code: number;
}

interface ErrorStatistic {
  error_type: string;
  error_count: number;
  unique_errors: number;
  resolved_count: number;
  resolution_rate: number;
  most_common_error: string;
}

interface RecentError {
  id: string;
  error_type: string;
  error_message: string;
  endpoint: string;
  status_code: number;
  resolved: boolean;
  occurred_at: string;
}

export default function Performance() {
  const [summary, setSummary] = useState<PerformanceSummary[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointPerformance[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStatistic[]>([]);
  const [recentErrors, setRecentErrors] = useState<RecentError[]>([]);
  const [timeRange, setTimeRange] = useState(24);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchPerformanceSummary(),
        fetchEndpointPerformance(),
        fetchErrorStatistics(),
        fetchRecentErrors(),
      ]);
    } catch (error: any) {
      console.error('Error fetching performance data:', error);
      toast.error('Failed to load performance metrics');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPerformanceSummary = async () => {
    const { data, error } = await supabase.rpc('get_performance_summary', {
      p_hours: timeRange
    });
    if (error) throw error;
    setSummary(data || []);
  };

  const fetchEndpointPerformance = async () => {
    const { data, error } = await supabase.rpc('get_endpoint_performance', {
      p_hours: timeRange
    });
    if (error) throw error;
    setEndpoints(data || []);
  };

  const fetchErrorStatistics = async () => {
    const { data, error } = await supabase.rpc('get_error_statistics', {
      p_hours: timeRange
    });
    if (error) throw error;
    setErrorStats(data || []);
  };

  const fetchRecentErrors = async () => {
    const { data, error } = await supabase.rpc('get_recent_errors', {
      p_limit: 20
    });
    if (error) throw error;
    setRecentErrors(data || []);
  };

  const handleResolveError = async (errorId: string) => {
    try {
      const { data, error } = await supabase.rpc('resolve_error', {
        p_error_id: errorId
      });
      if (error) throw error;
      toast.success('Error marked as resolved');
      fetchRecentErrors();
      fetchErrorStatistics();
    } catch (error: any) {
      console.error('Error resolving error:', error);
      toast.error('Failed to resolve error');
    }
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatMs = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalErrors = errorStats.reduce((acc, stat) => acc + stat.error_count, 0);
  const totalResolved = errorStats.reduce((acc, stat) => acc + stat.resolved_count, 0);
  const overallResolutionRate = totalErrors > 0 ? (totalResolved / totalErrors) * 100 : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Metrics</h1>
          <p className="text-muted-foreground mt-1">
            System performance and error monitoring
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg bg-background"
          >
            <option value={1}>Last hour</option>
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary.reduce((acc, s) => acc + s.sample_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              samples collected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              {totalResolved} resolved ({overallResolutionRate.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {endpoints.reduce((acc, e) => acc + e.total_requests, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {endpoints.length} endpoints
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {endpoints.length > 0
                ? formatMs(endpoints.reduce((acc, e) => acc + e.avg_response_time, 0) / endpoints.length)
                : '0ms'}
            </div>
            <p className="text-xs text-muted-foreground">
              across all endpoints
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">API Endpoints</TabsTrigger>
          <TabsTrigger value="errors">Errors</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Summary</CardTitle>
              <CardDescription>
                {summary.length > 0
                  ? `Showing ${summary.length} metrics`
                  : 'No performance data collected yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Category</th>
                        <th className="px-4 py-2 text-left">Metric</th>
                        <th className="px-4 py-2 text-right">Avg</th>
                        <th className="px-4 py-2 text-right">P50</th>
                        <th className="px-4 py-2 text-right">P95</th>
                        <th className="px-4 py-2 text-right">P99</th>
                        <th className="px-4 py-2 text-right">Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((metric, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">
                            <Badge variant="outline">{metric.category}</Badge>
                          </td>
                          <td className="px-4 py-2">{metric.metric_name}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            {metric.avg_value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {metric.p50_value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {metric.p95_value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {metric.p99_value.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {metric.sample_count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No performance data available</p>
                  <p className="text-sm mt-2">
                    Performance metrics will appear here as the system is used
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API Endpoint Performance</CardTitle>
              <CardDescription>
                {endpoints.length > 0
                  ? `Tracking ${endpoints.length} endpoints`
                  : 'No API metrics collected yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {endpoints.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Endpoint</th>
                        <th className="px-4 py-2 text-left">Method</th>
                        <th className="px-4 py-2 text-right">Avg Time</th>
                        <th className="px-4 py-2 text-right">Max Time</th>
                        <th className="px-4 py-2 text-right">Requests</th>
                        <th className="px-4 py-2 text-right">Errors</th>
                        <th className="px-4 py-2 text-right">Error Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoints.map((endpoint, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2 font-mono text-xs">
                            {endpoint.endpoint}
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="outline">{endpoint.method}</Badge>
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${
                            getStatusColor(endpoint.avg_response_time, { good: 200, warning: 1000 })
                          }`}>
                            {formatMs(endpoint.avg_response_time)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {formatMs(endpoint.max_response_time)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {endpoint.total_requests}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {endpoint.error_count}
                          </td>
                          <td className={`px-4 py-2 text-right ${
                            getStatusColor(endpoint.error_rate, { good: 1, warning: 5 })
                          }`}>
                            {endpoint.error_rate.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No API metrics available</p>
                  <p className="text-sm mt-2">
                    API performance data will be collected automatically
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Errors Tab */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error Statistics</CardTitle>
              <CardDescription>
                {errorStats.length > 0
                  ? `${errorStats.length} error types detected`
                  : 'No errors logged'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errorStats.length > 0 ? (
                <div className="space-y-4">
                  {errorStats.map((stat, idx) => (
                    <div key={idx} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge>{stat.error_type}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {stat.error_count} occurrences
                          </span>
                        </div>
                        <span className="text-sm font-medium">
                          {stat.resolution_rate.toFixed(1)}% resolved
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Most common: {stat.most_common_error || 'N/A'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Check className="h-12 w-12 mx-auto mb-4 opacity-20 text-green-600" />
                  <p>No errors logged</p>
                  <p className="text-sm mt-2">
                    System is running smoothly
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {recentErrors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Errors</CardTitle>
                <CardDescription>Last 20 errors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentErrors.map((error) => (
                    <div key={error.id} className="flex items-start justify-between border rounded-lg p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{error.error_type}</Badge>
                          {error.status_code && (
                            <Badge variant="secondary">{error.status_code}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(error.occurred_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{error.error_message}</p>
                        {error.endpoint && (
                          <p className="text-xs text-muted-foreground mt-1 font-mono">
                            {error.endpoint}
                          </p>
                        )}
                      </div>
                      {!error.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveError(error.id)}
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                      {error.resolved && (
                        <Badge variant="secondary">
                          <Check className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

