'use client';

import { FileText } from 'lucide-react';
import { LogViewer } from '@/components/features/logs/LogViewer';

export default function LogsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Request Logs</h1>
            <p className="text-sm text-muted-foreground">
              View and analyze API requests across all integrations
            </p>
          </div>
        </div>
      </div>

      {/* Log Viewer */}
      <LogViewer />
    </div>
  );
}
