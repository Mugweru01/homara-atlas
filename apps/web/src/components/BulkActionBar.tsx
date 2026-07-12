import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onAction: (action: string) => void;
  actions: { value: string; label: string }[];
}

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onAction,
  actions,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground rounded-lg shadow-lg p-4 flex items-center gap-4 animate-in slide-in-from-bottom-5">
      <Badge variant="secondary" className="text-lg px-3 py-1">
        {selectedCount} selected
      </Badge>

      <Select onValueChange={onAction}>
        <SelectTrigger className="w-[200px] bg-primary-foreground text-primary">
          <SelectValue placeholder="Choose action..." />
        </SelectTrigger>
        <SelectContent>
          {actions.map((action) => (
            <SelectItem key={action.value} value={action.value}>
              {action.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClearSelection}
        className="hover:bg-primary-foreground/20"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

