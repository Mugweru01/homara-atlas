import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  Database,
  HardDrive,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Table as TableIcon,
  Flag,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface SystemMetric {
  metric_name: string;
  metric_type: string;
  value: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  recorded_at: string;
}

interface MonitoringAlert {
  id: string;
  alert_name: string;
  severity: string;
  message: string;
  alert_status: string;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}

export default function Monitoring() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = async () => {
    try {
      // Get system metrics
      const { data: metricsData, error: metricsError } = await supabase
        .rpc('get_system_metrics');

      if (metricsError) throw metricsError;
      setMetrics(metricsData || []);

      // Get recent alerts
      const { data: alertsData, error: alertsError } = await supabase
        .rpc('get_recent_monitoring_alerts', { p_limit: 10 });

      if (alertsError) throw alertsError;
      setAlerts(alertsData || []);

      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('Error fetching monitoring data:', error);
      toast.error('Failed to load monitoring data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      const { error } = await supabase
        .rpc('acknowledge_monitoring_alert', { p_alert_id: alertId });

      if (error) throw error;

      toast.success('Alert acknowledged');
      fetchData();
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      toast.error('Failed to acknowledge alert');
    }
  };

  const getMetricIcon = (metricType: string, metricName: string) => {
    if (metricName.includes('connection')) return <Activity className="h-5 w-5" />;
    if (metricName.includes('size')) return <HardDrive className="h-5 w-5" />;
    if (metricName.includes('tables')) return <TableIcon className="h-5 w-5" />;
    if (metricName.includes('session')) return <Clock className="h-5 w-5" />;
    if (metricName.includes('user')) return <Users className="h-5 w-5" />;
    if (metricName.includes('verification')) return <Shield className="h-5 w-5" />;
    if (metricName.includes('flag')) return <Flag className="h-5 w-5" />;
    return <Database className="h-5 w-5" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Healthy</Badge>;
      case 'warning':
        return <Badge variant="secondary"><AlertTriangle className="h-3 w-3 mr-1" /> Warning</Badge>;
      case 'critical':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Critical</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary">Warning</Badge>;
      case 'info':
        return <Badge variant="outline">Info</Badge>;
      default:
        return <Badge>{severity}</Badge>;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'mb') {
      if (value >= 1024) {
        return `${(value / 1024).toFixed(2)} GB`;
      }
      return `${value.toFixed(2)} MB`;
    }
    if (unit === '%') {
      return `${value.toFixed(1)}%`;
    }
    return value.toFixed(0);
  };

  const formatMetricName = (name: string) => {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const criticalMetrics = metrics.filter(m => m.status === 'critical');
  const warningMetrics = metrics.filter(m => m.status === 'warning');
  const healthyMetrics = metrics.filter(m => m.status === 'healthy');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Monitoring</h1>
          <p className="text-muted-foreground mt-1">
            Real-time system health and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </span>
          <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-900">Healthy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <span className="text-3xl font-bold text-green-900">{healthyMetrics.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-900">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <span className="text-3xl font-bold text-yellow-900">{warningMetrics.length}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-900">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <span className="text-3xl font-bold text-red-900">{criticalMetrics.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts Banner */}
      {criticalMetrics.length > 0 && (
        <Card className="border-red-500 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Critical Issues Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {criticalMetrics.map((metric, index) => (
                <li key={index} className="flex items-center gap-2 text-red-800">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">{formatMetricName(metric.metric_name)}:</span>
                  <span>{formatValue(metric.value, metric.unit)} {metric.unit}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* System Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className={
            metric.status === 'critical' ? 'border-red-300' :
            metric.status === 'warning' ? 'border-yellow-300' :
            ''
          }>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getMetricIcon(metric.metric_type, metric.metric_name)}
                  <CardTitle className="text-sm font-medium">
                    {formatMetricName(metric.metric_name)}
                  </CardTitle>
                </div>
                {getStatusBadge(metric.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatValue(metric.value, metric.unit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {metric.metric_type}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>
            System alerts and notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                    <TableCell className="font-medium">{alert.alert_name}</TableCell>
                    <TableCell className="max-w-md truncate">{alert.message}</TableCell>
                    <TableCell>
                      <Badge variant={alert.alert_status === 'new' ? 'destructive' : 'outline'}>
                        {alert.alert_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {alert.alert_status === 'new' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-600" />
              <p>No alerts - All systems healthy</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

