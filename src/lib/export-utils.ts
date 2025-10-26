/**
 * Export Utilities
 * 
 * Functions for exporting data to CSV and PDF formats
 */

import { toast } from 'sonner';

/**
 * Export data to CSV format
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
): void {
  try {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    // Determine columns
    const exportColumns = columns || Object.keys(data[0]).map(key => ({ key, label: key }));

    // Create CSV header
    const headers = exportColumns.map(col => col.label).join(',');

    // Create CSV rows
    const rows = data.map(row => {
      return exportColumns
        .map(col => {
          const value = row[col.key];
          // Handle complex values
          if (value === null || value === undefined) return '';
          if (typeof value === 'object') return JSON.stringify(value).replace(/,/g, ';');
          // Escape commas and quotes
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        })
        .join(',');
    });

    // Combine header and rows
    const csv = [headers, ...rows].join('\n');

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success('Data exported successfully');
  } catch (error) {
    console.error('Export to CSV failed', error);
    toast.error('Failed to export data');
  }
}

/**
 * Export data to JSON format
 */
export function exportToJSON<T>(data: T[], filename: string): void {
  try {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast.success('Data exported successfully');
  } catch (error) {
    console.error('Export to JSON failed', error);
    toast.error('Failed to export data');
  }
}

/**
 * Format date for export
 */
export function formatDateForExport(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString();
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .toLowerCase()
    .substring(0, 50);
}

