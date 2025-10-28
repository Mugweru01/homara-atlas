import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Filter,
  Search,
  X,
  Save,
  Star,
  Trash2,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'daterange' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface FilterCriteria {
  [key: string]: any;
}

export interface SavedFilter {
  id: string;
  filter_name: string;
  filter_description: string | null;
  filter_criteria: FilterCriteria;
  is_public: boolean;
  is_default: boolean;
  is_own: boolean;
  usage_count: number;
  last_used_at: string | null;
}

interface AdvancedFilterProps {
  pageType: string;
  fields: FilterField[];
  onFilterChange: (criteria: FilterCriteria) => void;
  searchPlaceholder?: string;
}

export function AdvancedFilter({
  pageType,
  fields,
  onFilterChange,
  searchPlaceholder = 'Search...',
}: AdvancedFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  // Load saved filters
  useEffect(() => {
    loadSavedFilters();
  }, [pageType]);

  const loadSavedFilters = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_saved_filters', { p_page_type: pageType });

      if (error) throw error;
      setSavedFilters(data || []);

      // Apply default filter if exists
      const defaultFilter = data?.find((f: SavedFilter) => f.is_default);
      if (defaultFilter) {
        setFilters(defaultFilter.filter_criteria);
        onFilterChange(defaultFilter.filter_criteria);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // Remove empty values
    if (!value || (Array.isArray(value) && value.length === 0)) {
      delete newFilters[key];
    }
    
    setFilters(newFilters);
  };

  const applyFilters = () => {
    const combinedCriteria = {
      ...filters,
      ...(searchQuery ? { search: searchQuery } : {}),
    };
    
    onFilterChange(combinedCriteria);
    setIsOpen(false);
    
    // Record search if there's a query
    if (searchQuery) {
      supabase.rpc('record_search', {
        p_page_type: pageType,
        p_search_query: searchQuery,
        p_search_type: 'advanced',
      });
    }
  };

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
    onFilterChange({});
  };

  const applySavedFilter = async (filter: SavedFilter) => {
    setFilters(filter.filter_criteria);
    onFilterChange(filter.filter_criteria);
    setIsOpen(false);

    // Track usage
    await supabase.rpc('track_filter_usage', { p_filter_id: filter.id });
    loadSavedFilters(); // Refresh to update usage count
  };

  const saveCurrentFilter = async () => {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('save_filter', {
        p_filter_name: filterName,
        p_page_type: pageType,
        p_filter_criteria: filters,
        p_filter_description: filterDescription || null,
        p_is_public: isPublic,
        p_is_default: isDefault,
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Filter saved successfully');
        setIsSaveDialogOpen(false);
        setFilterName('');
        setFilterDescription('');
        setIsPublic(false);
        setIsDefault(false);
        loadSavedFilters();
      } else {
        toast.error(data.error || 'Failed to save filter');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save filter');
    }
  };

  const deleteSavedFilter = async (filterId: string) => {
    try {
      const { data, error } = await supabase.rpc('delete_saved_filter', {
        p_filter_id: filterId,
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Filter deleted');
        loadSavedFilters();
      } else {
        toast.error(data.error || 'Failed to delete filter');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete filter');
    }
  };

  const activeFilterCount = Object.keys(filters).length + (searchQuery ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyFilters();
              }
            }}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => {
                setSearchQuery('');
                if (Object.keys(filters).length === 0) {
                  onFilterChange({});
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {activeFilterCount}
                </Badge>
              )}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0" align="end">
            <ScrollArea className="max-h-[600px]">
              <div className="p-4 space-y-4">
                {/* Saved Filters */}
                {savedFilters.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Saved Filters</Label>
                    <div className="space-y-1">
                      {savedFilters.map((filter) => (
                        <div
                          key={filter.id}
                          className="flex items-center justify-between p-2 hover:bg-accent rounded-md group"
                        >
                          <button
                            onClick={() => applySavedFilter(filter)}
                            className="flex-1 text-left flex items-center gap-2"
                          >
                            {filter.is_default && (
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                            )}
                            <span className="text-sm font-medium">{filter.filter_name}</span>
                            {filter.is_public && (
                              <Badge variant="outline" className="text-xs">Public</Badge>
                            )}
                            {filter.usage_count > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({filter.usage_count} uses)
                              </span>
                            )}
                          </button>
                          {filter.is_own && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                              onClick={() => deleteSavedFilter(filter.id)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    <Separator />
                  </div>
                )}

                {/* Filter Fields */}
                <div className="space-y-3">
                  <Label className="text-xs font-semibold">Filter Criteria</Label>
                  {fields.map((field) => (
                    <div key={field.key} className="space-y-2">
                      <Label className="text-sm">{field.label}</Label>
                      {field.type === 'text' && (
                        <Input
                          placeholder={field.placeholder}
                          value={filters[field.key] || ''}
                          onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        />
                      )}
                      {field.type === 'select' && (
                        <Select
                          value={filters[field.key]}
                          onValueChange={(value) => handleFilterChange(field.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={field.placeholder || 'Select...'} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {field.type === 'number' && (
                        <Input
                          type="number"
                          placeholder={field.placeholder}
                          value={filters[field.key] || ''}
                          onChange={(e) => handleFilterChange(field.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <Separator />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearFilters}
                      disabled={activeFilterCount === 0}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSaveDialogOpen(true)}
                      disabled={activeFilterCount === 0}
                    >
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                  </div>
                  <Button size="sm" onClick={applyFilters}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button
                onClick={() => {
                  setSearchQuery('');
                  applyFilters();
                }}
                className="ml-1"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {Object.entries(filters).map(([key, value]) => {
            const field = fields.find((f) => f.key === key);
            return (
              <Badge key={key} variant="secondary" className="gap-1">
                {field?.label}: {String(value)}
                <button
                  onClick={() => {
                    const newFilters = { ...filters };
                    delete newFilters[key];
                    setFilters(newFilters);
                    onFilterChange(newFilters);
                  }}
                  className="ml-1"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-6 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Save Filter Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
            <DialogDescription>
              Save your current filter settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Filter Name *</Label>
              <Input
                placeholder="e.g., Pending Verifications"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Describe what this filter does..."
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="public"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                />
                <Label htmlFor="public" className="text-sm font-normal">
                  Make public (visible to all admins)
                </Label>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="default"
                checked={isDefault}
                onCheckedChange={(checked) => setIsDefault(checked as boolean)}
              />
              <Label htmlFor="default" className="text-sm font-normal">
                Set as default filter for this page
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrentFilter}>
              <Save className="h-4 w-4 mr-2" />
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

