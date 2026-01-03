'use client';

import { X, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface BulkActionBarProps {
  selectedCount: number;
  onDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionBar({ selectedCount, onDelete, onClearSelection }: BulkActionBarProps) {
  const handleExport = () => {
    // TODO: Implement export functionality
    toast.info('Export coming soon');
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-secondary/50 bg-secondary/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} action{selectedCount !== 1 && 's'} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Selected
        </Button>
      </div>
    </div>
  );
}
