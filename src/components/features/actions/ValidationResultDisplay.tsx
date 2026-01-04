'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  Shield,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

// Types matching the gateway response schema
interface ValidationIssue {
  path: string;
  message: string;
  code: string;
  severity?: 'error' | 'warning';
  expected?: unknown;
  received?: unknown;
}

interface ValidationMetadata {
  valid: boolean;
  mode: 'strict' | 'warn' | 'lenient';
  issueCount: number;
  issues?: ValidationIssue[];
  fieldsCoerced: number;
  fieldsStripped: number;
  fieldsDefaulted: number;
  validationDurationMs: number;
  driftStatus?: 'normal' | 'warning' | 'alert';
  driftMessage?: string;
}

interface ValidationResultDisplayProps {
  validation: ValidationMetadata;
  className?: string;
}

export function ValidationResultDisplay({ validation, className }: ValidationResultDisplayProps) {
  const hasIssues = validation.issueCount > 0;
  const hasTransformations =
    validation.fieldsCoerced > 0 || validation.fieldsStripped > 0 || validation.fieldsDefaulted > 0;

  // Determine overall status color
  const getStatusColor = () => {
    if (!validation.valid) return 'destructive';
    if (validation.driftStatus === 'alert') return 'destructive';
    if (validation.driftStatus === 'warning') return 'secondary';
    if (hasIssues) return 'secondary';
    return 'default';
  };

  const getModeDescription = () => {
    switch (validation.mode) {
      case 'strict':
        return 'Strict mode - fails on any schema mismatch';
      case 'warn':
        return 'Warn mode - logs issues but passes data through';
      case 'lenient':
        return 'Lenient mode - coerces types and uses defaults';
    }
  };

  return (
    <div className={cn('rounded-lg border bg-card p-3 text-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {validation.valid ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive" />
          )}
          <span className="font-medium">
            {validation.valid ? 'Validation Passed' : 'Validation Failed'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={getStatusColor()} className="text-xs">
            {validation.mode.toUpperCase()}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {validation.validationDurationMs}ms
          </span>
        </div>
      </div>

      {/* Mode description */}
      <p className="mt-1 text-xs text-muted-foreground">{getModeDescription()}</p>

      {/* Drift Status (if not normal) */}
      {validation.driftStatus && validation.driftStatus !== 'normal' && (
        <div
          className={cn(
            'mt-2 flex items-center gap-2 rounded-md p-2 text-xs',
            validation.driftStatus === 'alert'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
          )}
        >
          <ShieldAlert className="h-4 w-4" />
          <div>
            <span className="font-medium">
              Schema Drift {validation.driftStatus === 'alert' ? 'Alert' : 'Warning'}
            </span>
            {validation.driftMessage && (
              <p className="mt-0.5 opacity-80">{validation.driftMessage}</p>
            )}
          </div>
        </div>
      )}

      {/* Transformations Summary */}
      {hasTransformations && (
        <div className="mt-2 flex flex-wrap gap-2">
          {validation.fieldsCoerced > 0 && (
            <Badge variant="outline" className="text-xs">
              <Info className="mr-1 h-3 w-3" />
              {validation.fieldsCoerced} field{validation.fieldsCoerced !== 1 ? 's' : ''} coerced
            </Badge>
          )}
          {validation.fieldsStripped > 0 && (
            <Badge variant="outline" className="text-xs">
              <Info className="mr-1 h-3 w-3" />
              {validation.fieldsStripped} field{validation.fieldsStripped !== 1 ? 's' : ''} stripped
            </Badge>
          )}
          {validation.fieldsDefaulted > 0 && (
            <Badge variant="outline" className="text-xs">
              <Info className="mr-1 h-3 w-3" />
              {validation.fieldsDefaulted} field{validation.fieldsDefaulted !== 1 ? 's' : ''}{' '}
              defaulted
            </Badge>
          )}
        </div>
      )}

      {/* Validation Issues */}
      {hasIssues && validation.issues && validation.issues.length > 0 && (
        <Collapsible className="mt-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs hover:bg-muted/50">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              {validation.issueCount} validation issue{validation.issueCount !== 1 ? 's' : ''}
            </span>
            <span className="text-muted-foreground">Click to expand</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-2">
              {validation.issues.map((issue, index) => (
                <div
                  key={index}
                  className={cn(
                    'rounded-md border-l-2 bg-muted/30 p-2 text-xs',
                    issue.severity === 'error' ? 'border-l-destructive' : 'border-l-yellow-500'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <code className="font-mono text-[10px] text-muted-foreground">
                      {issue.path}
                    </code>
                    <Badge variant="outline" className="text-[10px]">
                      {issue.code}
                    </Badge>
                  </div>
                  <p className="mt-1">{issue.message}</p>
                  {(issue.expected !== undefined || issue.received !== undefined) && (
                    <div className="mt-1 flex gap-4 text-[10px] text-muted-foreground">
                      {issue.expected !== undefined && (
                        <span>
                          Expected: <code>{JSON.stringify(issue.expected)}</code>
                        </span>
                      )}
                      {issue.received !== undefined && (
                        <span>
                          Received: <code>{JSON.stringify(issue.received)}</code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* No Issues Message */}
      {!hasIssues && validation.valid && (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
          <Shield className="h-3 w-3" />
          Response matches expected schema
        </div>
      )}
    </div>
  );
}

/**
 * Compact validation badge for use in lists/tables
 */
interface ValidationBadgeProps {
  validation?: ValidationMetadata;
  className?: string;
}

export function ValidationBadge({ validation, className }: ValidationBadgeProps) {
  if (!validation) {
    return (
      <Badge variant="outline" className={cn('text-xs', className)}>
        <Shield className="mr-1 h-3 w-3" />
        Not validated
      </Badge>
    );
  }

  if (!validation.valid) {
    return (
      <Badge variant="destructive" className={cn('text-xs', className)}>
        <AlertCircle className="mr-1 h-3 w-3" />
        Invalid
      </Badge>
    );
  }

  if (validation.driftStatus === 'alert') {
    return (
      <Badge variant="destructive" className={cn('text-xs', className)}>
        <ShieldAlert className="mr-1 h-3 w-3" />
        Drift Alert
      </Badge>
    );
  }

  if (validation.driftStatus === 'warning' || validation.issueCount > 0) {
    return (
      <Badge variant="secondary" className={cn('text-xs', className)}>
        <AlertTriangle className="mr-1 h-3 w-3" />
        {validation.issueCount} issue{validation.issueCount !== 1 ? 's' : ''}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn('text-xs text-green-600', className)}>
      <CheckCircle className="mr-1 h-3 w-3" />
      Valid
    </Badge>
  );
}
