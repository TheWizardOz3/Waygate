'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowRight, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useMappings,
  useMappingConfig,
  useCreateMapping,
  useDeleteMapping,
} from '@/hooks/useMappings';
import type { FieldMapping, MappingDirection, CoercionType } from '@/lib/modules/execution/mapping';

interface MappingsTabProps {
  actionId: string;
  integrationId: string;
}

export function MappingsTab({ actionId, integrationId }: MappingsTabProps) {
  const { data: mappingsData, isLoading, refetch } = useMappings(actionId, integrationId);
  const { data: config, mutateAsync: updateConfig, isPending: configPending } = useMappingConfig(
    actionId,
    integrationId
  );

  const mappings = mappingsData?.mappings ?? [];
  const enabled = config?.enabled ?? false;
  const failureMode = config?.failureMode ?? 'passthrough';

  const handleToggleEnabled = async (value: boolean) => {
    try {
      await updateConfig({ enabled: value });
      toast.success(value ? 'Mapping enabled' : 'Mapping disabled');
      refetch();
    } catch {
      toast.error('Failed to update');
    }
  };

  const handleChangeFailureMode = async (value: string) => {
    try {
      await updateConfig({ failureMode: value as 'fail' | 'passthrough' });
      toast.success('Failure mode updated');
      refetch();
    } catch {
      toast.error('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Field Mapping</CardTitle>
            <CardDescription>
              Transform fields between your app and the external API using JSONPath
            </CardDescription>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={configPending}
          />
        </div>
      </CardHeader>

      {enabled && (
        <CardContent className="space-y-4">
          {/* Failure Mode */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>On Error</Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <strong>Passthrough:</strong> Return original data if mapping fails (safe).<br/>
                  <strong>Strict:</strong> Fail the request if mapping fails.
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={failureMode}
              onValueChange={handleChangeFailureMode}
              disabled={configPending}
            >
              <SelectTrigger className="w-36 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passthrough">Passthrough</SelectItem>
                <SelectItem value="fail">Strict</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mappings Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-24">Direction</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-24">Coerce To</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <MappingRow
                    key={mapping.id}
                    mapping={mapping}
                    actionId={actionId}
                    integrationId={integrationId}
                    onDelete={refetch}
                  />
                ))}
                <AddMappingRow
                  actionId={actionId}
                  integrationId={integrationId}
                  onAdd={refetch}
                />
              </TableBody>
            </Table>
          </div>

          {mappings.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No mappings configured. Use the row above to add your first mapping.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Example: <code className="bg-muted px-1 rounded">$.data.user_email</code> → <code className="bg-muted px-1 rounded">$.email</code>
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// =============================================================================
// Mapping Row
// =============================================================================

interface MappingRowProps {
  mapping: FieldMapping;
  actionId: string;
  integrationId: string;
  onDelete: () => void;
}

function MappingRow({ mapping, actionId, integrationId, onDelete }: MappingRowProps) {
  const { mutateAsync: deleteMapping, isPending } = useDeleteMapping(actionId, integrationId);

  const handleDelete = async () => {
    if (!mapping.id) return;
    try {
      await deleteMapping(mapping.id);
      toast.success('Mapping deleted');
      onDelete();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const coercionType = mapping.transformConfig?.coercion?.type;

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {mapping.direction}
        </Badge>
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
          {mapping.sourcePath}
        </code>
      </TableCell>
      <TableCell>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
          {mapping.targetPath}
        </code>
      </TableCell>
      <TableCell>
        {coercionType ? (
          <Badge variant="secondary" className="text-xs">
            {coercionType}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// Add Mapping Row
// =============================================================================

interface AddMappingRowProps {
  actionId: string;
  integrationId: string;
  onAdd: () => void;
}

function AddMappingRow({ actionId, integrationId, onAdd }: AddMappingRowProps) {
  const [direction, setDirection] = useState<MappingDirection>('output');
  const [sourcePath, setSourcePath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [coercionType, setCoercionType] = useState<CoercionType | 'none'>('none');

  const { mutateAsync: createMapping, isPending } = useCreateMapping(actionId, integrationId);

  const canAdd = sourcePath.trim() && targetPath.trim();

  const handleAdd = async () => {
    if (!canAdd) return;

    try {
      const transformConfig = {
        omitIfNull: false,
        omitIfEmpty: false,
        arrayMode: 'all' as const,
        ...(coercionType !== 'none' && { coercion: { type: coercionType } }),
      };

      await createMapping({
        sourcePath: sourcePath.trim(),
        targetPath: targetPath.trim(),
        direction,
        transformConfig,
      });
      toast.success('Mapping added');
      setSourcePath('');
      setTargetPath('');
      setCoercionType('none');
      onAdd();
    } catch {
      toast.error('Failed to add mapping');
    }
  };

  return (
    <TableRow className="bg-muted/30">
      <TableCell>
        <Select value={direction} onValueChange={(v) => setDirection(v as MappingDirection)}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="output">output</SelectItem>
            <SelectItem value="input">input</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          placeholder="$.data.field"
          className="h-7 text-xs font-mono"
        />
      </TableCell>
      <TableCell>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <Input
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
          placeholder="$.field"
          className="h-7 text-xs font-mono"
        />
      </TableCell>
      <TableCell>
        <Select value={coercionType} onValueChange={(v) => setCoercionType(v as CoercionType | 'none')}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">—</SelectItem>
            <SelectItem value="string">string</SelectItem>
            <SelectItem value="number">number</SelectItem>
            <SelectItem value="boolean">boolean</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleAdd}
          disabled={!canAdd || isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
        </Button>
      </TableCell>
    </TableRow>
  );
}

