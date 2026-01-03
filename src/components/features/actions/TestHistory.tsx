'use client';

import { useState, useEffect } from 'react';
import { History, Trash2, Play, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';

export interface TestHistoryItem {
  id: string;
  actionId: string;
  timestamp: number;
  input: Record<string, unknown>;
  response?: {
    status: number;
    duration?: number;
  };
  error?: string;
}

const STORAGE_KEY = 'waygate_test_history';
const MAX_HISTORY_ITEMS = 20;

interface TestHistoryProps {
  actionId: string;
  onReplay: (input: Record<string, unknown>) => void;
}

export function TestHistory({ actionId, onReplay }: TestHistoryProps) {
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const allHistory: TestHistoryItem[] = JSON.parse(stored);
        const filtered = allHistory.filter((item) => item.actionId === actionId);
        setHistory(filtered);
      } catch {
        // Invalid storage, ignore
      }
    }
  }, [actionId]);

  const clearHistory = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const allHistory: TestHistoryItem[] = JSON.parse(stored);
        const filtered = allHistory.filter((item) => item.actionId !== actionId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        setHistory([]);
      } catch {
        // Invalid storage, clear all
        localStorage.removeItem(STORAGE_KEY);
        setHistory([]);
      }
    }
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="h-auto w-full justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <History className="h-4 w-4" />
            <span>Recent Tests</span>
            <Badge variant="secondary" className="ml-1">
              {history.length}
            </Badge>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm text-muted-foreground">Test History</span>
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 className="mr-1 h-4 w-4" />
              Clear
            </Button>
          </div>
          <ScrollArea className="max-h-[300px]">
            <div className="divide-y">
              {history.map((item) => (
                <HistoryItem key={item.id} item={item} onReplay={onReplay} />
              ))}
            </div>
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HistoryItem({
  item,
  onReplay,
}: {
  item: TestHistoryItem;
  onReplay: (input: Record<string, unknown>) => void;
}) {
  const isSuccess = item.response && item.response.status >= 200 && item.response.status < 300;

  return (
    <div className="flex items-center justify-between p-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full ${
            item.error ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
        <div>
          <p className="max-w-[200px] truncate font-mono text-sm">
            {JSON.stringify(item.input).slice(0, 50)}
            {JSON.stringify(item.input).length > 50 && '...'}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDistanceToNow(item.timestamp, { addSuffix: true })}</span>
            {item.response && (
              <>
                <span>•</span>
                <span>{item.response.status}</span>
                {item.response.duration && (
                  <>
                    <span>•</span>
                    <span>{item.response.duration}ms</span>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onReplay(item.input)}>
        <Play className="mr-1 h-4 w-4" />
        Replay
      </Button>
    </div>
  );
}

// Utility functions for managing test history
export function addToTestHistory(item: Omit<TestHistoryItem, 'id'>): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  let history: TestHistoryItem[] = [];

  if (stored) {
    try {
      history = JSON.parse(stored);
    } catch {
      // Invalid storage, start fresh
    }
  }

  const newItem: TestHistoryItem = {
    ...item,
    id: crypto.randomUUID(),
  };

  // Add to front and limit total items
  history = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}
