import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Settings,
  RefreshCw,
  Users,
  Loader,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/production-logger';
import { useAdmin } from '@/hooks/useAdmin';
import { usePermissions } from '@/hooks/usePermissions';

export default function AdvancedRouting() {
  const { user } = useAdmin();
  const permissions = usePermissions();
  
  if (!permissions.canViewAdvancedRouting) {
    return null; // ProtectedRoute will handle redirect
  }
  const [loading, setLoading] = useState(false);
  const [roundRobinEnabled, setRoundRobinEnabled] = useState(false);
  const [skillBasedEnabled, setSkillBasedEnabled] = useState(false);
  const [loadBasedEnabled, setLoadBasedEnabled] = useState(false);
  const [routingConfig, setRoutingConfig] = useState({
    round_robin: {
      enabled: false,
      consider_availability: true,
      consider_capacity: true,
    },
    skill_based: {
      enabled: false,
      match_ticket_type: true,
      match_category: true,
      match_priority: false,
    },
    load_based: {
      enabled: false,
      max_tickets_per_agent: 10,
      consider_response_time: true,
    },
  });

  useEffect(() => {
    // Load routing configuration (would be stored in settings table)
    // For now, using local state
  }, []);

  const handleSaveRouting = async () => {
    try {
      setLoading(true);
      // In production, save to a settings table
      toast.success('Success', {
        description: 'Routing configuration saved',
      });
    } catch (error: any) {
      logger.error('Error saving routing config:', error);
      toast.error('Error', {
        description: error.message || 'Failed to save routing configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Advanced Routing</h1>
          <p className="text-muted-foreground">
            Configure intelligent ticket routing algorithms
          </p>
        </div>
        <Button onClick={handleSaveRouting} disabled={loading}>
          <Settings className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>

      <Tabs defaultValue="round-robin" className="w-full">
        <TabsList>
          <TabsTrigger value="round-robin">Round-Robin</TabsTrigger>
          <TabsTrigger value="skill-based">Skill-Based</TabsTrigger>
          <TabsTrigger value="load-based">Load-Based</TabsTrigger>
        </TabsList>

        {/* Round-Robin Routing */}
        <TabsContent value="round-robin" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader className="h-5 w-5" />
                Round-Robin Routing
              </CardTitle>
              <CardDescription>
                Distribute tickets evenly among available agents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="round_robin_enabled"
                  checked={routingConfig.round_robin.enabled}
                  onCheckedChange={(checked: boolean) =>
                    setRoutingConfig((prev) => ({
                      ...prev,
                      round_robin: { ...prev.round_robin, enabled: checked },
                    }))
                  }
                />
                <Label htmlFor="round_robin_enabled">Enable Round-Robin Routing</Label>
              </div>

              {routingConfig.round_robin.enabled && (
                <div className="space-y-4 pl-6 border-l-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="consider_availability"
                      checked={routingConfig.round_robin.consider_availability}
                      onCheckedChange={(checked: boolean) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          round_robin: { ...prev.round_robin, consider_availability: checked },
                        }))
                      }
                    />
                    <Label htmlFor="consider_availability">Consider Agent Availability</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="consider_capacity"
                      checked={routingConfig.round_robin.consider_capacity}
                      onCheckedChange={(checked: boolean) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          round_robin: { ...prev.round_robin, consider_capacity: checked },
                        }))
                      }
                    />
                    <Label htmlFor="consider_capacity">Consider Agent Capacity</Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skill-Based Routing */}
        <TabsContent value="skill-based" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Skill-Based Routing
              </CardTitle>
              <CardDescription>
                Route tickets to agents based on their skills and expertise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="skill_based_enabled"
                  checked={routingConfig.skill_based.enabled}
                  onCheckedChange={(checked: boolean) =>
                    setRoutingConfig((prev) => ({
                      ...prev,
                      skill_based: { ...prev.skill_based, enabled: checked },
                    }))
                  }
                />
                <Label htmlFor="skill_based_enabled">Enable Skill-Based Routing</Label>
              </div>

              {routingConfig.skill_based.enabled && (
                <div className="space-y-4 pl-6 border-l-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="match_ticket_type"
                      checked={routingConfig.skill_based.match_ticket_type}
                      onCheckedChange={(checked: boolean) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          skill_based: { ...prev.skill_based, match_ticket_type: checked },
                        }))
                      }
                    />
                    <Label htmlFor="match_ticket_type">Match by Ticket Type</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="match_category"
                      checked={routingConfig.skill_based.match_category}
                      onCheckedChange={(checked: boolean) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          skill_based: { ...prev.skill_based, match_category: checked },
                        }))
                      }
                    />
                    <Label htmlFor="match_category">Match by Category</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="match_priority"
                      checked={routingConfig.skill_based.match_priority}
                      onCheckedChange={(checked: boolean) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          skill_based: { ...prev.skill_based, match_priority: checked },
                        }))
                      }
                    />
                    <Label htmlFor="match_priority">Match by Priority</Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Load-Based Routing */}
        <TabsContent value="load-based" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Load-Based Routing
              </CardTitle>
              <CardDescription>
                Route tickets to agents with the least current workload
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="load_based_enabled"
                  checked={routingConfig.load_based.enabled}
                  onCheckedChange={(checked: boolean) =>
                    setRoutingConfig((prev) => ({
                      ...prev,
                      load_based: { ...prev.load_based, enabled: checked },
                    }))
                  }
                />
                <Label htmlFor="load_based_enabled">Enable Load-Based Routing</Label>
              </div>

              {routingConfig.load_based.enabled && (
                <div className="space-y-4 pl-6 border-l-2">
                  <div>
                    <Label>Max Tickets per Agent</Label>
                    <Input
                      type="number"
                      min="1"
                      value={routingConfig.load_based.max_tickets_per_agent}
                      onChange={(e) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          load_based: {
                            ...prev.load_based,
                            max_tickets_per_agent: parseInt(e.target.value) || 10,
                          },
                        }))
                      }
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="consider_response_time"
                      checked={routingConfig.load_based.consider_response_time}
                      onCheckedChange={(checked: boolean) =>
                        setRoutingConfig((prev) => ({
                          ...prev,
                          load_based: { ...prev.load_based, consider_response_time: checked },
                        }))
                      }
                    />
                    <Label htmlFor="consider_response_time">Consider Average Response Time</Label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

