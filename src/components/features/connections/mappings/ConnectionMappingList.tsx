'use client';

import { useState } from 'react';
import {
  Plus,
  Loader2,
  RotateCcw,
  Copy,
  Layers,
  GitBranch,
  Pencil,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConnectionMappingCard } from './ConnectionMappingCard';
import { OverrideMappingDialog } from './OverrideMappingDialog';
import { ResetMappingsDialog } from './ResetMappingsDialog';
import { useConnectionMappings, useCopyDefaultsToConnection } from '@/hooks';
import type { Action } from '@prisma/client';

interface ConnectionMappingListProps {
  connectionId: string;
  actions: Pick<Action, 'id' | 'name' | 'slug'>[];
}

/**
 * List of connection-specific mappings for a selected action
 */
export function ConnectionMappingList({ connectionId, actions }: ConnectionMappingListProps) {
  const [selectedActionId, setSelectedActionId] = useState<string | undefined>(
    actions.length > 0 ? actions[0].id : undefined
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const {
    data: mappingsData,
    isLoading,
    refetch,
  } = useConnectionMappings(connectionId, selectedActionId);

  const { mutateAsync: copyDefaults, isPending: copyPending } =
    useCopyDefaultsToConnection(connectionId);

  const mappings = mappingsData?.mappings ?? [];
  const stats = mappingsData?.stats;
  const config = mappingsData?.config;

  const handleCopyDefaults = async () => {
    if (!selectedActionId) return;
    try {
      await copyDefaults({ actionId: selectedActionId });
      refetch();
    } catch {
      // Error toast handled by hook
    }
  };

  // Filter mappings by direction for display
  const inputMappings = mappings.filter((m) => m.mapping.direction === 'input');
  const outputMappings = mappings.filter((m) => m.mapping.direction === 'output');

  if (actions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No actions configured for this integration yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create actions in the integration settings to configure custom mappings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Layers className="h-4 w-4" />
              Field Mappings
            </CardTitle>
            <CardDescription>Customize how data is transformed for this connection</CardDescription>
          </div>

          {/* Action Selector */}
          <Select value={selectedActionId} onValueChange={setSelectedActionId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select action" />
            </SelectTrigger>
            <SelectContent>
              {actions.map((action) => (
                <SelectItem key={action.id} value={action.id}>
                  {action.name || action.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Stats Bar */}
        {stats && selectedActionId && (
          <div className="mt-4 flex items-center gap-4 rounded-lg border bg-muted/30 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-sm">
                    <GitBranch className="h-3.5 w-3.5 text-slate-500" />
                    <span className="font-medium">{stats.defaultsCount}</span>
                    <span className="text-muted-foreground">inherited</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Mappings inherited from action defaults</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="h-4 w-px bg-border" />

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Pencil className="h-3.5 w-3.5 text-violet-500" />
                    <span className="font-medium">{stats.overridesCount}</span>
                    <span className="text-muted-foreground">
                      override{stats.overridesCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Custom mappings for this connection</p>
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex-1" />

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  Actions
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Override
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyDefaults} disabled={copyPending}>
                  {copyPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  Copy Defaults to Overrides
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setResetDialogOpen(true)}
                  disabled={stats.overridesCount === 0}
                  className="text-destructive focus:text-destructive"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Defaults
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedActionId ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Select an action to view its mappings</p>
          </div>
        ) : mappings.length === 0 ? (
          <div className="py-12 text-center">
            <Layers className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No mappings configured for this action</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mappings transform data between your app and the external API
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setAddDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add First Override
            </Button>
          </div>
        ) : (
          <>
            {/* Mapping Config Info */}
            {config && !config.enabled && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    Mapping is disabled for this action
                  </p>
                  <p className="text-muted-foreground">
                    Enable mapping in the action settings for these mappings to take effect.
                  </p>
                </div>
              </div>
            )}

            {/* Output Mappings */}
            {outputMappings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    output
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Transform API response before returning to your app
                  </span>
                </div>
                <div className="space-y-2">
                  {outputMappings.map((rm, idx) => (
                    <ConnectionMappingCard
                      key={rm.mapping.id ?? `output-${idx}`}
                      resolvedMapping={rm}
                      connectionId={connectionId}
                      actionId={selectedActionId}
                      onDeleted={() => refetch()}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Input Mappings */}
            {inputMappings.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    input
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Transform your request before sending to API
                  </span>
                </div>
                <div className="space-y-2">
                  {inputMappings.map((rm, idx) => (
                    <ConnectionMappingCard
                      key={rm.mapping.id ?? `input-${idx}`}
                      resolvedMapping={rm}
                      connectionId={connectionId}
                      actionId={selectedActionId}
                      onDeleted={() => refetch()}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Dialogs */}
      {selectedActionId && (
        <>
          <OverrideMappingDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            connectionId={connectionId}
            actionId={selectedActionId}
            onCreated={() => refetch()}
          />
          <ResetMappingsDialog
            open={resetDialogOpen}
            onOpenChange={setResetDialogOpen}
            connectionId={connectionId}
            actionId={selectedActionId}
            overrideCount={stats?.overridesCount ?? 0}
            onReset={() => refetch()}
          />
        </>
      )}
    </Card>
  );
}
