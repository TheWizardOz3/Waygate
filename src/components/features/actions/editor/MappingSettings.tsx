'use client';

import { useState } from 'react';
import { Plus, Trash2, ArrowRight, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  useMappings,
  useMappingConfig,
  useCreateMapping,
  useDeleteMapping,
} from '@/hooks/useMappings';
import type { FieldMapping, MappingDirection, CoercionType } from '@/lib/modules/execution/mapping';

interface MappingSettingsProps {
  actionId: string;
  integrationId: string;
}

export function MappingSettings({ actionId, integrationId }: MappingSettingsProps) {
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

  const handleChangeFailureMode = async (value: 'fail' | 'passthrough') => {
    try {
      await updateConfig({ failureMode: value });
      refetch();
    } catch {
      toast.error('Failed to update');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Switch
            checked={enabled}
            onCheckedChange={handleToggleEnabled}
            disabled={configPending}
          />
          <div>
            <Label className="text-sm font-medium">Field Mapping</Label>
            <p className="text-xs text-muted-foreground">
              Transform fields between your app and the API
            </p>
          </div>
        </div>

        {enabled && (
          <Select
            value={failureMode}
            onValueChange={handleChangeFailureMode}
            disabled={configPending}
          >
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="passthrough">Passthrough</SelectItem>
              <SelectItem value="fail">Strict</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Mappings Table */}
      {enabled && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[100px]">Direction</TableHead>
                <TableHead>Source Path</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Target Path</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[60px]"></TableHead>
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

          {mappings.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No mappings yet. Add one above.
            </div>
          )}
        </div>
      )}
    </div>
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
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
          {mapping.sourcePath}
        </code>
      </TableCell>
      <TableCell>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
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
  const [coercionType, setCoercionType] = useState<CoercionType | ''>('');

  const { mutateAsync: createMapping, isPending } = useCreateMapping(actionId, integrationId);

  const canAdd = sourcePath.trim() && targetPath.trim();

  const handleAdd = async () => {
    if (!canAdd) return;

    try {
      await createMapping({
        sourcePath: sourcePath.trim(),
        targetPath: targetPath.trim(),
        direction,
        transformConfig: coercionType
          ? {
              omitIfNull: false,
              omitIfEmpty: false,
              arrayMode: 'all',
              coercion: { type: coercionType },
            }
          : {
              omitIfNull: false,
              omitIfEmpty: false,
              arrayMode: 'all',
            },
      });
      toast.success('Mapping added');
      setSourcePath('');
      setTargetPath('');
      setCoercionType('');
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48" align="end">
            <div className="space-y-2">
              <Label className="text-xs">Type Coercion</Label>
              <Select
                value={coercionType}
                onValueChange={(v) => setCoercionType(v as CoercionType | '')}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PopoverContent>
        </Popover>
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
