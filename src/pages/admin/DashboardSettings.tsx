import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
  Settings, GripVertical, RotateCcw, Save, Eye, EyeOff,
  LayoutGrid
} from 'lucide-react';
import { toast } from 'sonner';

interface Widget {
  id: string;
  widget_key: string;
  widget_name: string;
  widget_description: string;
  widget_category: string;
  default_size: string;
  min_role: string;
}

interface LayoutItem {
  id: string;
  position: number;
  visible: boolean;
  size: string;
}

export default function DashboardSettings() {
  const [availableWidgets, setAvailableWidgets] = useState<Widget[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch available widgets
      const { data: widgets, error: widgetsError } = await supabase
        .rpc('get_available_widgets');
      
      if (widgetsError) throw widgetsError;
      setAvailableWidgets(widgets || []);

      // Fetch current layout
      const { data: layoutData, error: layoutError } = await supabase
        .rpc('get_dashboard_layout');
      
      if (layoutError) throw layoutError;
      setLayout(layoutData || []);
    } catch (error: any) {
      console.error('Error fetching dashboard settings:', error);
      toast.error('Failed to load dashboard settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleWidget = (widgetId: string) => {
    setLayout(prev => prev.map(item =>
      item.id === widgetId
        ? { ...item, visible: !item.visible }
        : item
    ));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newLayout = [...layout];
    const draggedItem = newLayout[draggedIndex];
    newLayout.splice(draggedIndex, 1);
    newLayout.splice(index, 0, draggedItem);
    
    // Update positions
    newLayout.forEach((item, idx) => {
      item.position = idx;
    });

    setLayout(newLayout);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc('save_dashboard_layout', {
        p_layout: layout
      });

      if (error) throw error;
      
      toast.success('Dashboard layout saved successfully!');
    } catch (error: any) {
      console.error('Error saving layout:', error);
      toast.error('Failed to save dashboard layout');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset to default layout? This cannot be undone.')) {
      return;
    }

    try {
      const { data, error } = await supabase.rpc('reset_dashboard_layout');

      if (error) throw error;
      
      if (data.layout) {
        setLayout(data.layout);
      }
      
      toast.success('Dashboard layout reset to default');
    } catch (error: any) {
      console.error('Error resetting layout:', error);
      toast.error('Failed to reset dashboard layout');
    }
  };

  const getWidgetInfo = (widgetId: string) => {
    return availableWidgets.find(w => w.widget_key === widgetId);
  };

  const visibleCount = layout.filter(item => item.visible).length;
  const hiddenCount = layout.length - visibleCount;

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Dashboard Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize your dashboard layout and widgets
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Layout'}
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Widgets</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{layout.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Visible</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{visibleCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hidden</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">{hiddenCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Widgets List */}
      <Card>
        <CardHeader>
          <CardTitle>Widget Configuration</CardTitle>
          <CardDescription>
            Drag to reorder, toggle to show/hide widgets on your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {layout.map((item, index) => {
              const widget = getWidgetInfo(item.id);
              if (!widget) return null;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors cursor-move ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${!item.visible ? 'bg-muted' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${!item.visible ? 'text-muted-foreground' : ''}`}>
                          {widget.widget_name}
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {widget.widget_category}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {widget.widget_description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground min-w-[60px]">
                      Position {index + 1}
                    </span>
                    <Switch
                      checked={item.visible}
                      onCheckedChange={() => handleToggleWidget(item.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Drag & Drop:</strong> Click and hold on a widget, then drag to reorder</p>
          <p>• <strong>Toggle Visibility:</strong> Use the switch to show/hide widgets</p>
          <p>• <strong>Save Changes:</strong> Click "Save Layout" to apply your changes</p>
          <p>• <strong>Reset:</strong> Click "Reset to Default" to restore original layout</p>
        </CardContent>
      </Card>
    </div>
  );
}

