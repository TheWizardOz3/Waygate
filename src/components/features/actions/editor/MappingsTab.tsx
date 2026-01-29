'use client';

import { useState, useMemo } from 'react';
import { Plus, Trash2, ArrowRight, Loader2, Info, Users, FileCode } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  useMappings,
  useMappingConfig,
  useCreateMapping,
  useDeleteMapping,
} from '@/hooks/useMappings';
import {
  getSchemaFieldPaths,
  type FieldMapping,
  type MappingDirection,
  type CoercionType,
  type SchemaFieldInfo,
} from '@/lib/modules/execution/mapping';
import type { JsonSchema } from '@/lib/modules/actions/action.schemas';

interface MappingsTabProps {
  actionId: string;
  integrationId: string;
  inputSchema?: JsonSchema | null;
  outputSchema?: JsonSchema | null;
}

export function MappingsTab({
  actionId,
  integrationId,
  inputSchema,
  outputSchema,
}: MappingsTabProps) {
  const {
    data: mappingsData,
    isLoading,
    refetch,
  } = useMappings(actionId, integrationId, {
    includeStats: true,
  });
  const {
    data: config,
    mutateAsync: updateConfig,
    isPending: configPending,
  } = useMappingConfig(actionId, integrationId);

  const mappings = useMemo(() => mappingsData?.mappings ?? [], [mappingsData?.mappings]);
  const stats = mappingsData?.stats;
  const connectionsWithOverrides = stats?.connectionsWithOverrides ?? 0;
  const enabled = config?.enabled ?? false;
  const failureMode = config?.failureMode ?? 'passthrough';

  // Extract fields from schemas
  const outputFields = useMemo(() => {
    if (!outputSchema) return [];
    return getSchemaFieldPaths(outputSchema as Parameters<typeof getSchemaFieldPaths>[0]);
  }, [outputSchema]);

  const inputFields = useMemo(() => {
    if (!inputSchema) return [];
    return getSchemaFieldPaths(inputSchema as Parameters<typeof getSchemaFieldPaths>[0]);
  }, [inputSchema]);

  // Filter out fields that already have mappings configured
  const configuredOutputPaths = useMemo(
    () => new Set(mappings.filter((m) => m.direction === 'output').map((m) => m.sourcePath)),
    [mappings]
  );

  const configuredInputPaths = useMemo(
    () => new Set(mappings.filter((m) => m.direction === 'input').map((m) => m.sourcePath)),
    [mappings]
  );

  const availableOutputFields = useMemo(
    () => outputFields.filter((f) => !configuredOutputPaths.has(f.path)),
    [outputFields, configuredOutputPaths]
  );

  const availableInputFields = useMemo(
    () => inputFields.filter((f) => !configuredInputPaths.has(f.path)),
    [inputFields, configuredInputPaths]
  );

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
          <div className="flex items-center gap-3">
            {/* Connection Overrides Indicator */}
            {connectionsWithOverrides > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                  >
                    <Users className="h-3 w-3" />
                    {connectionsWithOverrides} connection{connectionsWithOverrides !== 1 ? 's' : ''}{' '}
                    with overrides
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    {connectionsWithOverrides} connection
                    {connectionsWithOverrides !== 1 ? 's have' : ' has'} custom mapping overrides.
                    View connection details to manage per-app mappings.
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            <Switch
              checked={enabled}
              onCheckedChange={handleToggleEnabled}
              disabled={configPending}
            />
          </div>
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
                  <strong>Passthrough:</strong> Return original data if mapping fails (safe).
                  <br />
                  <strong>Strict:</strong> Fail the request if mapping fails.
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={failureMode}
              onValueChange={handleChangeFailureMode}
              disabled={configPending}
            >
              <SelectTrigger className="h-8 w-36">
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
                <AddMappingRow actionId={actionId} integrationId={integrationId} onAdd={refetch} />
              </TableBody>
            </Table>
          </div>

          {mappings.length === 0 && (
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No mappings configured. Use the row above to add your first mapping.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Example: <code className="rounded bg-muted px-1">$.data.user_email</code> →{' '}
                <code className="rounded bg-muted px-1">$.email</code>
              </p>
            </div>
          )}

          {/* Schema Fields Suggestions */}
          {(availableOutputFields.length > 0 || availableInputFields.length > 0) && (
            <SchemaFieldsSection
              outputFields={availableOutputFields}
              inputFields={availableInputFields}
              actionId={actionId}
              integrationId={integrationId}
              onMappingAdded={refetch}
            />
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
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
          {mapping.sourcePath}
        </code>
      </TableCell>
      <TableCell>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
      </TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
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
          className="h-7 font-mono text-xs"
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
          className="h-7 font-mono text-xs"
        />
      </TableCell>
      <TableCell>
        <Select
          value={coercionType}
          onValueChange={(v) => setCoercionType(v as CoercionType | 'none')}
        >
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

// =============================================================================
// Schema Fields Section
// =============================================================================

interface SchemaFieldsSectionProps {
  outputFields: SchemaFieldInfo[];
  inputFields: SchemaFieldInfo[];
  actionId: string;
  integrationId: string;
  onMappingAdded: () => void;
}

function SchemaFieldsSection({
  outputFields,
  inputFields,
  actionId,
  integrationId,
  onMappingAdded,
}: SchemaFieldsSectionProps) {
  const [outputOpen, setOutputOpen] = useState(true);
  const [inputOpen, setInputOpen] = useState(true);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileCode className="h-4 w-4" />
        <span>Available Schema Fields</span>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              These fields are detected from your action&apos;s schema. Click the + button to add a
              mapping, then specify the target path for your app.
            </p>
          </TooltipContent>
        </Tooltip>
      </div>

      {outputFields.length > 0 && (
        <Collapsible open={outputOpen} onOpenChange={setOutputOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 h-8 w-full justify-between px-3 text-xs"
            >
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  output
                </Badge>
                Response Fields ({outputFields.length})
              </span>
              <ArrowRight
                className={`h-3 w-3 transition-transform ${outputOpen ? 'rotate-90' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
              {outputFields.map((field) => (
                <SchemaFieldRow
                  key={field.path}
                  field={field}
                  direction="output"
                  actionId={actionId}
                  integrationId={integrationId}
                  onMappingAdded={onMappingAdded}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {inputFields.length > 0 && (
        <Collapsible open={inputOpen} onOpenChange={setInputOpen}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 h-8 w-full justify-between px-3 text-xs"
            >
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  input
                </Badge>
                Request Fields ({inputFields.length})
              </span>
              <ArrowRight
                className={`h-3 w-3 transition-transform ${inputOpen ? 'rotate-90' : ''}`}
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1.5 rounded-md border bg-muted/20 p-2">
              {inputFields.map((field) => (
                <SchemaFieldRow
                  key={field.path}
                  field={field}
                  direction="input"
                  actionId={actionId}
                  integrationId={integrationId}
                  onMappingAdded={onMappingAdded}
                />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// =============================================================================
// Schema Field Row
// =============================================================================

interface SchemaFieldRowProps {
  field: SchemaFieldInfo;
  direction: MappingDirection;
  actionId: string;
  integrationId: string;
  onMappingAdded: () => void;
}

function SchemaFieldRow({
  field,
  direction,
  actionId,
  integrationId,
  onMappingAdded,
}: SchemaFieldRowProps) {
  const [targetPath, setTargetPath] = useState('');
  const { mutateAsync: createMapping, isPending } = useCreateMapping(actionId, integrationId);

  const handleAdd = async () => {
    if (!targetPath.trim()) return;

    try {
      await createMapping({
        sourcePath: field.path,
        targetPath: targetPath.trim(),
        direction,
        transformConfig: {
          omitIfNull: false,
          omitIfEmpty: false,
          arrayMode: 'all' as const,
        },
      });
      toast.success('Mapping added');
      setTargetPath('');
      onMappingAdded();
    } catch {
      toast.error('Failed to add mapping');
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5">
      <div className="flex flex-1 items-center gap-2">
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{field.path}</code>
        <Badge variant="secondary" className="text-[10px]">
          {field.type}
        </Badge>
        {field.required && (
          <Badge variant="outline" className="border-amber-500/30 text-[10px] text-amber-600">
            required
          </Badge>
        )}
      </div>
      <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
      <Input
        value={targetPath}
        onChange={(e) => setTargetPath(e.target.value)}
        placeholder="$.yourField"
        className="h-7 w-36 font-mono text-xs"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && targetPath.trim()) {
            handleAdd();
          }
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleAdd}
        disabled={!targetPath.trim() || isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
