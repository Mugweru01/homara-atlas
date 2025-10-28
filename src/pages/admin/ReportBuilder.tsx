import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Plus, Save, Play, Download, Trash2, Copy, FileText,
  Database, Filter, SortAsc, Columns
} from 'lucide-react';
import { toast } from 'sonner';
import { exportToCSV, exportToJSON } from '@/lib/export-utils';

interface DataSource {
  source_name: string;
  display_name: string;
  description: string;
  available_columns: string[];
  available_filters: string[];
}

interface SavedReport {
  id: string;
  report_name: string;
  report_description: string;
  data_source: string;
  category: string;
  usage_count: number;
  last_run_at: string;
  created_at: string;
}

export default function ReportBuilder() {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [category, setCategory] = useState('');
  const [limitRows, setLimitRows] = useState(1000);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'saved'>('builder');

  useEffect(() => {
    fetchDataSources();
    fetchSavedReports();
  }, []);

  const fetchDataSources = async () => {
    try {
      const { data, error } = await supabase.rpc('get_report_data_sources');
      if (error) throw error;
      setDataSources(data || []);
    } catch (error: any) {
      console.error('Error fetching data sources:', error);
      toast.error('Failed to load data sources');
    }
  };

  const fetchSavedReports = async () => {
    try {
      const { data, error } = await supabase.rpc('get_my_custom_reports');
      if (error) throw error;
      setSavedReports(data || []);
    } catch (error: any) {
      console.error('Error fetching saved reports:', error);
    }
  };

  const handleColumnToggle = (column: string) => {
    setSelectedColumns(prev => 
      prev.includes(column)
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  const handlePreview = async () => {
    if (!selectedSource) {
      toast.error('Please select a data source');
      return;
    }

    setIsLoading(true);
    try {
      // For preview, we'll fetch directly from the table
      const { data, error } = await supabase
        .from(selectedSource)
        .select(selectedColumns.length > 0 ? selectedColumns.join(',') : '*')
        .limit(Math.min(limitRows, 100)); // Limit preview to 100 rows

      if (error) throw error;
      setPreviewData(data || []);
      toast.success(`Preview loaded: ${data?.length || 0} rows`);
    } catch (error: any) {
      console.error('Error previewing data:', error);
      toast.error('Failed to preview data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!reportName || !selectedSource) {
      toast.error('Please provide a report name and select a data source');
      return;
    }

    setIsSaving(true);
    try {
      const { data: adminData } = await supabase
        .from('admins')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!adminData) throw new Error('Admin not found');

      const { error } = await supabase
        .from('custom_report_definitions')
        .insert({
          admin_id: adminData.id,
          report_name: reportName,
          report_description: reportDescription,
          data_source: selectedSource,
          columns_config: JSON.stringify(selectedColumns),
          limit_rows: limitRows,
          category: category || null,
        });

      if (error) throw error;
      
      toast.success('Report saved successfully!');
      fetchSavedReports();
      
      // Reset form
      setReportName('');
      setReportDescription('');
      setSelectedColumns([]);
      setCategory('');
    } catch (error: any) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteReport = async (reportId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('execute_custom_report', {
        p_report_id: reportId
      });

      if (error) throw error;
      
      if (data.success) {
        setPreviewData(data.data || []);
        toast.success(`Report executed: ${data.row_count} rows in ${data.execution_time_ms}ms`);
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error executing report:', error);
      toast.error('Failed to execute report');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const { error } = await supabase
        .from('custom_report_definitions')
        .delete()
        .eq('id', reportId);

      if (error) throw error;
      
      toast.success('Report deleted');
      fetchSavedReports();
    } catch (error: any) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (previewData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const filename = `report-${Date.now()}`;
    
    if (format === 'csv') {
      exportToCSV(previewData, filename);
    } else {
      exportToJSON(previewData, filename);
    }
    
    toast.success(`Exported ${previewData.length} rows as ${format.toUpperCase()}`);
  };

  const currentDataSource = dataSources.find(ds => ds.source_name === selectedSource);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create custom reports with visual query interface
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'builder' ? 'default' : 'outline'}
            onClick={() => setActiveTab('builder')}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
          <Button
            variant={activeTab === 'saved' ? 'default' : 'outline'}
            onClick={() => setActiveTab('saved')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Saved Reports ({savedReports.length})
          </Button>
        </div>
      </div>

      {/* Builder Tab */}
      {activeTab === 'builder' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Data Source
                </CardTitle>
                <CardDescription>Select the data to query</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Table</Label>
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select data source" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataSources.map((source) => (
                        <SelectItem key={source.source_name} value={source.source_name}>
                          {source.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentDataSource && (
                    <p className="text-sm text-muted-foreground">
                      {currentDataSource.description}
                    </p>
                  )}
                </div>

                {currentDataSource && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Columns className="h-4 w-4" />
                      Columns
                    </Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-3">
                      {currentDataSource.available_columns.map((column) => (
                        <div key={column} className="flex items-center space-x-2">
                          <Checkbox
                            id={column}
                            checked={selectedColumns.includes(column)}
                            onCheckedChange={() => handleColumnToggle(column)}
                          />
                          <label
                            htmlFor={column}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {column}
                          </label>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedColumns(currentDataSource.available_columns)}
                      className="w-full"
                    >
                      Select All
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Row Limit</Label>
                  <Input
                    type="number"
                    value={limitRows}
                    onChange={(e) => setLimitRows(Number(e.target.value))}
                    min={1}
                    max={10000}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Save className="h-5 w-5" />
                  Save Report
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Name</Label>
                  <Input
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="My Custom Report"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description (Optional)</Label>
                  <Textarea
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="What does this report show?"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Category (Optional)</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Users, Financial, Performance"
                  />
                </div>

                <Button 
                  onClick={handleSave} 
                  disabled={isSaving || !reportName || !selectedSource}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Report'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Preview</CardTitle>
                    <CardDescription>
                      {previewData.length > 0 
                        ? `Showing ${previewData.length} rows`
                        : 'Run preview to see data'
                      }
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      onClick={handlePreview}
                      disabled={isLoading || !selectedSource}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {isLoading ? 'Loading...' : 'Preview'}
                    </Button>
                    {previewData.length > 0 && (
                      <>
                        <Button 
                          variant="outline"
                          onClick={() => handleExport('csv')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => handleExport('json')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          JSON
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {previewData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {Object.keys(previewData[0]).map((key) => (
                            <th key={key} className="px-4 py-2 text-left font-medium">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.slice(0, 50).map((row, idx) => (
                          <tr key={idx} className="border-t">
                            {Object.values(row).map((value: any, colIdx) => (
                              <td key={colIdx} className="px-4 py-2">
                                {value === null ? (
                                  <span className="text-muted-foreground italic">null</span>
                                ) : typeof value === 'object' ? (
                                  <span className="text-muted-foreground">
                                    {JSON.stringify(value)}
                                  </span>
                                ) : (
                                  String(value)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.length > 50 && (
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Showing first 50 of {previewData.length} rows. Export to see all data.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No data to display</p>
                    <p className="text-sm mt-2">
                      Select a data source and click Preview to see results
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Saved Reports Tab */}
      {activeTab === 'saved' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savedReports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle>{report.report_name}</CardTitle>
                <CardDescription>
                  {report.report_description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Source:</span>
                    <p className="font-medium">{report.data_source}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category:</span>
                    <p className="font-medium">{report.category || 'None'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Used:</span>
                    <p className="font-medium">{report.usage_count} times</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last run:</span>
                    <p className="font-medium text-xs">
                      {report.last_run_at 
                        ? new Date(report.last_run_at).toLocaleDateString()
                        : 'Never'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleExecuteReport(report.id)}
                    disabled={isLoading}
                    className="flex-1"
                    size="sm"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Run
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleDeleteReport(report.id)}
                    size="sm"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {savedReports.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p className="text-muted-foreground">No saved reports</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your first report in the Builder tab
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

