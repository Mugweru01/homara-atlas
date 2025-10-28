import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

export interface BulkAction {
  value: string;
  label: string;
  variant?: 'default' | 'destructive' | 'outline';
  requiresNote?: boolean;
  noteLabel?: string;
  notePlaceholder?: string;
}

interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  actions: BulkAction[];
  onAction: (action: string, note?: string) => Promise<{ success: boolean; updated: number; failed: number; results?: any }>;
  onClearSelection: () => void;
  entityName?: string; // e.g., "verification", "user", "listing"
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  actions,
  onAction,
  onClearSelection,
  entityName = 'item',
}: BulkActionsBarProps) {
  const [selectedAction, setSelectedAction] = useState<string>('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    updated: number;
    failed: number;
  } | null>(null);

  const currentAction = actions.find(a => a.value === selectedAction);

  const handleActionClick = () => {
    if (!selectedAction) return;
    setIsConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await onAction(selectedAction, note || undefined);

      clearInterval(progressInterval);
      setProgress(100);
      setResult(response);

      // Auto-close after showing result
      setTimeout(() => {
        setIsConfirmOpen(false);
        setIsProcessing(false);
        setProgress(0);
        setResult(null);
        setNote('');
        setSelectedAction('');
        onClearSelection();
      }, 2000);
    } catch (error) {
      console.error('Bulk action error:', error);
      setIsProcessing(false);
      setProgress(0);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-3">
          <Badge variant="default" className="px-3 py-1">
            {selectedCount} of {totalCount} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-8"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select action..." />
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
            onClick={handleActionClick}
            disabled={!selectedAction}
            variant={currentAction?.variant || 'default'}
          >
            Apply to {selectedCount} {entityName}{selectedCount !== 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isProcessing ? 'Processing...' : result ? 'Complete' : 'Confirm Bulk Action'}
            </DialogTitle>
            <DialogDescription>
              {!isProcessing && !result && (
                <>
                  You are about to <strong>{currentAction?.label.toLowerCase()}</strong> {selectedCount} {entityName}{selectedCount !== 1 ? 's' : ''}.
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {!isProcessing && !result && (
            <div className="space-y-4 py-4">
              {currentAction?.requiresNote && (
                <div className="space-y-2">
                  <Label>{currentAction.noteLabel || 'Note'}</Label>
                  <Textarea
                    placeholder={currentAction.notePlaceholder || 'Enter a note...'}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                  />
                </div>
              )}
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-900">Warning</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    This will affect {selectedCount} {entityName}{selectedCount !== 1 ? 's' : ''}. Please confirm you want to proceed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="space-y-4 py-6">
              <Progress value={progress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">
                Processing {selectedCount} {entityName}{selectedCount !== 1 ? 's' : ''}...
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4 py-6">
              <div className="flex flex-col items-center justify-center gap-4">
                {result.failed === 0 ? (
                  <>
                    <CheckCircle2 className="h-12 w-12 text-green-600" />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Success!</p>
                      <p className="text-sm text-muted-foreground">
                        Updated {result.updated} {entityName}{result.updated !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-12 w-12 text-yellow-600" />
                    <div className="text-center">
                      <p className="font-semibold text-lg">Partially Complete</p>
                      <p className="text-sm text-muted-foreground">
                        Updated {result.updated}, Failed {result.failed}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {!result && (
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isProcessing || (currentAction?.requiresNote && !note)}
                variant={currentAction?.variant || 'default'}
              >
                {isProcessing ? 'Processing...' : `Confirm & Apply`}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

