import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileDown, FileJson, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  downloadCSV,
  downloadJSON,
  generateExportFilename,
  estimateFileSize,
  type ExportColumn,
} from '@/lib/export-utils';

interface ExportButtonProps {
  data: any[];
  columns: ExportColumn[];
  filename: string;
  pageType: string;
  filterCriteria?: any;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

export function ExportButton({
  data,
  columns,
  filename,
  pageType,
  filterCriteria,
  disabled = false,
  variant = 'outline',
  size = 'default',
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const recordExport = async (
    exportType: 'csv' | 'json',
    fileName: string,
    recordCount: number,
    fileSizeBytes: number
  ) => {
    try {
      await supabase.rpc('record_export', {
        p_export_type: exportType,
        p_page_type: pageType,
        p_file_name: fileName,
        p_record_count: recordCount,
        p_filter_criteria: filterCriteria || null,
        p_columns_exported: columns.map(c => c.label),
        p_file_size_bytes: fileSizeBytes,
      });
    } catch (error) {
      console.error('Error recording export:', error);
      // Don't throw - export succeeded, just logging failed
    }
  };

  const handleExportCSV = async () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const fileName = generateExportFilename(filename, 'csv');
      const estimatedSize = estimateFileSize(data, columns);

      // Download the file
      downloadCSV(data, columns, fileName);

      // Record the export
      await recordExport('csv', fileName, data.length, estimatedSize);

      toast.success(`Exported ${data.length} records to CSV`, {
        description: fileName,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = async () => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const fileName = generateExportFilename(filename, 'json');
      const jsonString = JSON.stringify(data, null, 2);
      const fileSizeBytes = new Blob([jsonString]).size;

      // Download the file
      downloadJSON(data, fileName);

      // Record the export
      await recordExport('json', fileName, data.length, fileSizeBytes);

      toast.success(`Exported ${data.length} records to JSON`, {
        description: fileName,
      });
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={disabled || isExporting || data.length === 0}
          className="gap-2"
        >
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Export
              {data.length > 0 && (
                <span className="text-xs opacity-70">({data.length})</span>
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportCSV} disabled={isExporting}>
          <FileDown className="h-4 w-4 mr-2" />
          Export as CSV
          <span className="ml-auto text-xs text-muted-foreground">Excel-compatible</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} disabled={isExporting}>
          <FileJson className="h-4 w-4 mr-2" />
          Export as JSON
          <span className="ml-auto text-xs text-muted-foreground">Raw data</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

