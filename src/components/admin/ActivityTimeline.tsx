import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock,
  User,
  Shield,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Plus,
  Ban,
  Activity,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ActivityItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string | null;
  actor_type: string;
  actor_name: string | null;
  changes: any;
  metadata: any;
  ip_address: string | null;
  created_at: string;
}

interface ActivityTimelineProps {
  entityType: string;
  entityId: string;
  title?: string;
  description?: string;
  maxHeight?: string;
  limit?: number;
}

export function ActivityTimeline({
  entityType,
  entityId,
  title = 'Activity Timeline',
  description = 'History of all changes and actions',
  maxHeight = '500px',
  limit = 50,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [entityType, entityId]);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_activity_timeline', {
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_limit: limit,
      });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error('Error fetching activity timeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    const iconMap: Record<string, any> = {
      created: <Plus className="h-4 w-4" />,
      updated: <Edit className="h-4 w-4" />,
      deleted: <Trash2 className="h-4 w-4" />,
      approved: <CheckCircle className="h-4 w-4" />,
      rejected: <XCircle className="h-4 w-4" />,
      suspended: <Ban className="h-4 w-4" />,
      unsuspended: <CheckCircle className="h-4 w-4" />,
    };
    return iconMap[action] || <Activity className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    const colorMap: Record<string, string> = {
      created: 'bg-blue-500',
      updated: 'bg-yellow-500',
      deleted: 'bg-red-500',
      approved: 'bg-green-500',
      rejected: 'bg-red-500',
      suspended: 'bg-orange-500',
      unsuspended: 'bg-green-500',
    };
    return colorMap[action] || 'bg-gray-500';
  };

  const getActionBadge = (action: string) => {
    const variantMap: Record<string, any> = {
      created: 'default',
      updated: 'secondary',
      deleted: 'destructive',
      approved: 'default',
      rejected: 'destructive',
      suspended: 'destructive',
      unsuspended: 'default',
    };
    return <Badge variant={variantMap[action] || 'outline'}>{action}</Badge>;
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'admin':
        return <Shield className="h-3 w-3" />;
      case 'user':
        return <User className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  const formatChanges = (changes: any) => {
    if (!changes || Object.keys(changes).length === 0) {
      return null;
    }

    return (
      <div className="mt-2 space-y-1 text-xs">
        {Object.entries(changes).map(([field, change]: [string, any]) => (
          <div key={field} className="flex items-center gap-2">
            <span className="font-medium text-muted-foreground capitalize">
              {field.replace(/_/g, ' ')}:
            </span>
            <span className="line-through text-destructive">
              {String(change.old)}
            </span>
            <span>→</span>
            <span className="text-primary font-medium">
              {String(change.new)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No activity yet</p>
            <p className="text-sm">Changes will appear here</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="relative space-y-4 before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-border">
              {activities.map((activity, index) => (
                <div key={activity.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2 top-2 w-4 h-4 rounded-full border-2 border-background ${getActionColor(
                      activity.action
                    )} flex items-center justify-center`}
                  >
                    <div className="text-white text-[10px]">
                      {getActionIcon(activity.action)}
                    </div>
                  </div>

                  {/* Activity content */}
                  <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getActionBadge(activity.action)}
                          <span className="text-sm text-muted-foreground">
                            by
                          </span>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            {getActorIcon(activity.actor_type)}
                            <span>
                              {activity.actor_name || activity.actor_type}
                            </span>
                          </div>
                        </div>

                        {formatChanges(activity.changes)}

                        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            {JSON.stringify(activity.metadata)}
                          </div>
                        )}
                      </div>

                      <div className="text-right text-xs text-muted-foreground">
                        <div title={format(new Date(activity.created_at), 'PPpp')}>
                          {formatDistanceToNow(new Date(activity.created_at), {
                            addSuffix: true,
                          })}
                        </div>
                        {activity.ip_address && (
                          <div className="mt-1 font-mono text-[10px]">
                            {activity.ip_address}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

