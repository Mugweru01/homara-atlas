import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, Clock, AlertTriangle, ArrowUpCircle, CalendarClock,
  ListTodo, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface Assignment {
  id: string;
  entity_type: string;
  entity_id: string;
  priority: string;
  due_date: string;
  status: string;
  entity_details: any;
  created_at: string;
}

interface Statistics {
  total_pending: number;
  in_progress: number;
  completed_today: number;
  overdue: number;
  high_priority: number;
}

export default function MyTasks() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'overdue' | 'high_priority'>('all');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchAssignments(),
        fetchStatistics(),
      ]);
    } catch (error: any) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAssignments = async () => {
    const { data, error } = await supabase.rpc('get_my_assignments');
    if (error) throw error;
    setAssignments(data || []);
  };

  const fetchStatistics = async () => {
    const { data, error } = await supabase.rpc('get_assignment_statistics');
    if (error) throw error;
    setStatistics(data);
  };

  const handleCompleteTask = async (assignmentId: string) => {
    try {
      const { data, error } = await supabase.rpc('complete_assignment', {
        p_assignment_id: assignmentId
      });

      if (error) throw error;
      
      if (data.success) {
        toast.success('Task completed!');
        fetchData();
      } else {
        toast.error(data.error || 'Failed to complete task');
      }
    } catch (error: any) {
      console.error('Error completing task:', error);
      toast.error('Failed to complete task');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'destructive';
      case 'normal': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <ArrowUpCircle className="h-4 w-4" />;
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  const getEntityName = (assignment: Assignment) => {
    if (assignment.entity_type === 'verification' && assignment.entity_details) {
      return `Verification #${assignment.entity_details.id?.substring(0, 8)}`;
    }
    if (assignment.entity_type === 'listing' && assignment.entity_details) {
      return assignment.entity_details.title || `Listing #${assignment.entity_id?.substring(0, 8)}`;
    }
    if (assignment.entity_type === 'flag' && assignment.entity_details) {
      return `Flag #${assignment.entity_id?.substring(0, 8)}`;
    }
    return `${assignment.entity_type} #${assignment.entity_id?.substring(0, 8)}`;
  };

  const filteredAssignments = assignments.filter(a => {
    if (filter === 'overdue') return a.due_date && isOverdue(a.due_date);
    if (filter === 'high_priority') return a.priority === 'high' || a.priority === 'urgent';
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ListTodo className="h-8 w-8" />
          My Tasks
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your assigned tasks and workflow items
        </p>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics?.total_pending || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{statistics?.in_progress || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{statistics?.completed_today || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{statistics?.overdue || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Priority</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{statistics?.high_priority || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          onClick={() => setFilter('all')}
          size="sm"
        >
          All Tasks ({assignments.length})
        </Button>
        <Button
          variant={filter === 'overdue' ? 'default' : 'outline'}
          onClick={() => setFilter('overdue')}
          size="sm"
        >
          Overdue ({assignments.filter(a => a.due_date && isOverdue(a.due_date)).length})
        </Button>
        <Button
          variant={filter === 'high_priority' ? 'default' : 'outline'}
          onClick={() => setFilter('high_priority')}
          size="sm"
        >
          High Priority ({assignments.filter(a => a.priority === 'high' || a.priority === 'urgent').length})
        </Button>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredAssignments.length > 0 ? (
          filteredAssignments.map((assignment) => {
            const overdue = assignment.due_date && isOverdue(assignment.due_date);
            
            return (
              <Card key={assignment.id} className={overdue ? 'border-red-500' : ''}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={getPriorityColor(assignment.priority)}>
                        <span className="flex items-center gap-1">
                          {getPriorityIcon(assignment.priority)}
                          {assignment.priority.toUpperCase()}
                        </span>
                      </Badge>
                      <Badge variant="outline">{assignment.entity_type}</Badge>
                      {overdue && (
                        <Badge variant="destructive">
                          <Clock className="h-3 w-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>
                    
                    <h3 className="font-medium text-lg">{getEntityName(assignment)}</h3>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      {assignment.due_date && (
                        <span className="flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          Due {formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })}
                        </span>
                      )}
                      <span>
                        Assigned {formatDistanceToNow(new Date(assignment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleCompleteTask(assignment.id)}
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Complete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-20 text-green-600" />
              <p className="text-muted-foreground">
                {filter === 'all' 
                  ? 'No tasks assigned'
                  : filter === 'overdue'
                  ? 'No overdue tasks'
                  : 'No high priority tasks'}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Great job staying on top of your work!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

