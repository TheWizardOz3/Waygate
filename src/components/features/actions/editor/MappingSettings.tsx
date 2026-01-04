'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Plus,
  Trash2,
  Settings2,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useMappings,
  useMappingConfig,
  useCreateMapping,
  useUpdateMapping,
  useDeleteMapping,
  usePreviewMapping,
} from '@/hooks/useMappings';
import type {
  FieldMapping,
  MappingConfig,
  MappingDirection,
  CoercionType,
  TransformConfig,
} from '@/lib/modules/execution/mapping';

interface MappingSettingsProps {
  actionId: string;
  integrationId: string;
}

/**
 * Mapping Settings Component
 *
 * Provides UI for configuring field mappings on an action.
 */
export function MappingSettings({ actionId, integrationId }: MappingSettingsProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<FieldMapping | null>(null);

  const {
    data: mappingsData,
    isLoading: mappingsLoading,
    refetch,
  } = useMappings(actionId, integrationId);
  const { data: config, isLoading: configLoading } = useMappingConfig(actionId, integrationId);

  const inputMappings =
    mappingsData?.mappings?.filter((m: FieldMapping) => m.direction === 'input') ?? [];
  const outputMappings =
    mappingsData?.mappings?.filter((m: FieldMapping) => m.direction === 'output') ?? [];

  const enabled = config?.enabled ?? false;

  const isLoading = mappingsLoading || configLoading;

  const handleAddMapping = (direction: MappingDirection) => {
    setEditingMapping({
      sourcePath: '$.',
      targetPath: '$.',
      direction,
      transformConfig: {
        omitIfNull: false,
        omitIfEmpty: false,
        arrayMode: 'all',
      },
    });
    setEditorOpen(true);
  };

  const handleEditMapping = (mapping: FieldMapping) => {
    setEditingMapping(mapping);
    setEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditingMapping(null);
  };

  const handleSaveSuccess = () => {
    handleCloseEditor();
    refetch();
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="mapping">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Field Mapping</span>
            {enabled && (
              <Badge variant="outline" className="ml-2">
                {inputMappings.length + outputMappings.length} mappings
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Config Controls */}
              <MappingConfigSection
                actionId={actionId}
                integrationId={integrationId}
                config={config}
                onUpdate={refetch}
              />

              {enabled && (
                <>
                  <Separator />

                  {/* Output Mappings (more common) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Output Mappings</h4>
                        <p className="text-xs text-muted-foreground">
                          Transform API response before returning to your app
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddMapping('output')}
                      >
                        <Plus className="mr-2 h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    {outputMappings.length > 0 ? (
                      <div className="space-y-2">
                        {outputMappings.map((mapping: FieldMapping) => (
                          <MappingRow
                            key={mapping.id}
                            mapping={mapping}
                            onEdit={handleEditMapping}
                            onDelete={refetch}
                            actionId={actionId}
                            integrationId={integrationId}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No output mappings configured
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Input Mappings */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-medium">Input Mappings</h4>
                        <p className="text-xs text-muted-foreground">
                          Transform request params before sending to API
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleAddMapping('input')}>
                        <Plus className="mr-2 h-3 w-3" />
                        Add
                      </Button>
                    </div>
                    {inputMappings.length > 0 ? (
                      <div className="space-y-2">
                        {inputMappings.map((mapping: FieldMapping) => (
                          <MappingRow
                            key={mapping.id}
                            mapping={mapping}
                            onEdit={handleEditMapping}
                            onDelete={refetch}
                            actionId={actionId}
                            integrationId={integrationId}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                        No input mappings configured
                      </div>
                    )}
                  </div>

                  {/* Preview Button */}
                  {(inputMappings.length > 0 || outputMappings.length > 0) && (
                    <>
                      <Separator />
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Test Mappings with Sample Data
                      </Button>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Mapping Editor Dialog */}
      <MappingEditorDialog
        open={editorOpen}
        mapping={editingMapping}
        actionId={actionId}
        integrationId={integrationId}
        onClose={handleCloseEditor}
        onSuccess={handleSaveSuccess}
      />

      {/* Preview Dialog */}
      <MappingPreviewDialog
        open={previewOpen}
        actionId={actionId}
        integrationId={integrationId}
        onClose={() => setPreviewOpen(false)}
      />
    </Accordion>
  );
}

// =============================================================================
// Config Section
// =============================================================================

interface MappingConfigSectionProps {
  actionId: string;
  integrationId: string;
  config: MappingConfig | undefined;
  onUpdate: () => void;
}

function MappingConfigSection({
  actionId,
  integrationId,
  config,
  onUpdate,
}: MappingConfigSectionProps) {
  const { mutateAsync: updateConfig, isPending } = useMappingConfig(actionId, integrationId);

  const enabled = config?.enabled ?? false;
  const preserveUnmapped = config?.preserveUnmapped ?? true;
  const failureMode = config?.failureMode ?? 'passthrough';

  const handleToggleEnabled = async (newValue: boolean) => {
    try {
      await (updateConfig as unknown as (data: Partial<MappingConfig>) => Promise<void>)({
        enabled: newValue,
      });
      toast.success(newValue ? 'Field mapping enabled' : 'Field mapping disabled');
      onUpdate();
    } catch {
      toast.error('Failed to update mapping configuration');
    }
  };

  const handleTogglePreserve = async (newValue: boolean) => {
    try {
      await (updateConfig as unknown as (data: Partial<MappingConfig>) => Promise<void>)({
        preserveUnmapped: newValue,
      });
      onUpdate();
    } catch {
      toast.error('Failed to update mapping configuration');
    }
  };

  const handleChangeFailureMode = async (newValue: 'fail' | 'passthrough') => {
    try {
      await (updateConfig as unknown as (data: Partial<MappingConfig>) => Promise<void>)({
        failureMode: newValue,
      });
      onUpdate();
    } catch {
      toast.error('Failed to update mapping configuration');
    }
  };

  return (
    <div className="space-y-4">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label className="text-base">Enable Field Mapping</Label>
          <p className="text-sm text-muted-foreground">
            Transform fields between your app and the external API
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggleEnabled} disabled={isPending} />
      </div>

      {enabled && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Preserve Unmapped */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-normal">Preserve Unmapped Fields</Label>
              <p className="text-xs text-muted-foreground">Keep fields not in mappings</p>
            </div>
            <Switch
              checked={preserveUnmapped}
              onCheckedChange={handleTogglePreserve}
              disabled={isPending}
            />
          </div>

          {/* Failure Mode */}
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-sm font-normal">Failure Mode</Label>
            <Select
              value={failureMode}
              onValueChange={(v) => handleChangeFailureMode(v as 'fail' | 'passthrough')}
              disabled={isPending}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passthrough">Passthrough (safe)</SelectItem>
                <SelectItem value="fail">Fail (strict)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {enabled && failureMode === 'passthrough' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            In passthrough mode, mapping errors return the original data with error metadata. Your
            requests won&apos;t fail due to mapping issues.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// =============================================================================
// Mapping Row
// =============================================================================

interface MappingRowProps {
  mapping: FieldMapping;
  onEdit: (mapping: FieldMapping) => void;
  onDelete: () => void;
  actionId: string;
  integrationId: string;
}

function MappingRow({ mapping, onEdit, onDelete, actionId, integrationId }: MappingRowProps) {
  const { mutateAsync: deleteMapping, isPending } = useDeleteMapping(actionId, integrationId);

  const handleDelete = async () => {
    if (!mapping.id) return;
    try {
      await deleteMapping(mapping.id);
      toast.success('Mapping deleted');
      onDelete();
    } catch {
      toast.error('Failed to delete mapping');
    }
  };

  const hasCoercion = !!mapping.transformConfig?.coercion;
  const hasDefault = mapping.transformConfig?.defaultValue !== undefined;

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <code className="truncate rounded bg-muted px-1.5 py-0.5 text-xs">
            {mapping.sourcePath}
          </code>
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          <code className="truncate rounded bg-muted px-1.5 py-0.5 text-xs">
            {mapping.targetPath}
          </code>
        </div>
        {(hasCoercion || hasDefault) && (
          <div className="mt-1 flex gap-1">
            {hasCoercion && (
              <Badge variant="secondary" className="text-xs">
                → {mapping.transformConfig?.coercion?.type}
              </Badge>
            )}
            {hasDefault && (
              <Badge variant="secondary" className="text-xs">
                default
              </Badge>
            )}
          </div>
        )}
      </div>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(mapping)}>
        <Settings2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

// =============================================================================
// Mapping Editor Dialog
// =============================================================================

interface MappingEditorDialogProps {
  open: boolean;
  mapping: FieldMapping | null;
  actionId: string;
  integrationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function MappingEditorDialog({
  open,
  mapping,
  actionId,
  integrationId,
  onClose,
  onSuccess,
}: MappingEditorDialogProps) {
  const isEditing = !!mapping?.id;

  const [sourcePath, setSourcePath] = useState(mapping?.sourcePath ?? '$.');
  const [targetPath, setTargetPath] = useState(mapping?.targetPath ?? '$.');
  const [direction, setDirection] = useState<MappingDirection>(mapping?.direction ?? 'output');
  const [coercionType, setCoercionType] = useState<CoercionType | ''>(
    mapping?.transformConfig?.coercion?.type ?? ''
  );
  const [defaultValue, setDefaultValue] = useState(
    mapping?.transformConfig?.defaultValue !== undefined
      ? JSON.stringify(mapping.transformConfig.defaultValue)
      : ''
  );
  const [omitIfNull, setOmitIfNull] = useState(mapping?.transformConfig?.omitIfNull ?? false);
  const [omitIfEmpty, setOmitIfEmpty] = useState(mapping?.transformConfig?.omitIfEmpty ?? false);

  // Reset form when mapping changes
  useState(() => {
    if (mapping) {
      setSourcePath(mapping.sourcePath);
      setTargetPath(mapping.targetPath);
      setDirection(mapping.direction);
      setCoercionType(mapping.transformConfig?.coercion?.type ?? '');
      setDefaultValue(
        mapping.transformConfig?.defaultValue !== undefined
          ? JSON.stringify(mapping.transformConfig.defaultValue)
          : ''
      );
      setOmitIfNull(mapping.transformConfig?.omitIfNull ?? false);
      setOmitIfEmpty(mapping.transformConfig?.omitIfEmpty ?? false);
    }
  });

  const { mutateAsync: createMapping, isPending: creating } = useCreateMapping(
    actionId,
    integrationId
  );
  const { mutateAsync: updateMapping, isPending: updating } = useUpdateMapping(
    actionId,
    integrationId
  );

  const isPending = creating || updating;

  const handleSave = async () => {
    // Build transform config
    const transformConfig: TransformConfig = {
      omitIfNull,
      omitIfEmpty,
      arrayMode: 'all',
    };

    if (coercionType) {
      transformConfig.coercion = { type: coercionType };
    }

    if (defaultValue) {
      try {
        transformConfig.defaultValue = JSON.parse(defaultValue);
      } catch {
        toast.error('Invalid default value JSON');
        return;
      }
    }

    try {
      if (isEditing && mapping?.id) {
        await updateMapping({
          mappingId: mapping.id,
          data: {
            sourcePath,
            targetPath,
            direction,
            transformConfig,
          },
        });
        toast.success('Mapping updated');
      } else {
        await createMapping({
          sourcePath,
          targetPath,
          direction,
          transformConfig,
        });
        toast.success('Mapping created');
      }
      onSuccess();
    } catch {
      toast.error('Failed to save mapping');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit' : 'Add'} Field Mapping</DialogTitle>
          <DialogDescription>
            Configure how fields are transformed between your app and the API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Direction */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as MappingDirection)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="output">Output (response)</SelectItem>
                <SelectItem value="input">Input (request)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source Path */}
          <div className="space-y-2">
            <Label>Source Path</Label>
            <Input
              value={sourcePath}
              onChange={(e) => setSourcePath(e.target.value)}
              placeholder="$.data.user_email"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              JSONPath to field in {direction === 'output' ? 'API response' : 'your request'}
            </p>
          </div>

          {/* Target Path */}
          <div className="space-y-2">
            <Label>Target Path</Label>
            <Input
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="$.email"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Path in {direction === 'output' ? "your app's data" : 'API request'}
            </p>
          </div>

          <Separator />

          {/* Transform Options */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Options</h4>

            {/* Type Coercion */}
            <div className="space-y-2">
              <Label>Type Coercion</Label>
              <Select
                value={coercionType}
                onValueChange={(v) => setCoercionType(v as CoercionType | '')}
              >
                <SelectTrigger>
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

            {/* Default Value */}
            <div className="space-y-2">
              <Label>Default Value (JSON)</Label>
              <Input
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder='null, "", 0, false, etc.'
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Value to use if source is missing</p>
            </div>

            {/* Omit Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Omit if source is null</Label>
                <Switch checked={omitIfNull} onCheckedChange={setOmitIfNull} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Omit if source is empty</Label>
                <Switch checked={omitIfEmpty} onCheckedChange={setOmitIfEmpty} />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Mapping'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Preview Dialog
// =============================================================================

interface MappingPreviewDialogProps {
  open: boolean;
  actionId: string;
  integrationId: string;
  onClose: () => void;
}

function MappingPreviewDialog({
  open,
  actionId,
  integrationId,
  onClose,
}: MappingPreviewDialogProps) {
  const [direction, setDirection] = useState<MappingDirection>('output');
  const [sampleData, setSampleData] = useState(
    '{\n  "data": {\n    "user_email": "test@example.com"\n  }\n}'
  );
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutateAsync: preview, isPending } = usePreviewMapping(actionId, integrationId);

  const handlePreview = async () => {
    setError(null);
    setResult(null);

    try {
      const parsed = JSON.parse(sampleData);
      const response = await preview({ sampleData: parsed, direction });
      setResult(response as Record<string, unknown>);
    } catch (e) {
      if (e instanceof SyntaxError) {
        setError('Invalid JSON in sample data');
      } else {
        setError('Preview failed');
      }
    }
  };

  const copyResult = () => {
    if (result) {
      navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      toast.success('Copied to clipboard');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Mappings</DialogTitle>
          <DialogDescription>Preview how your mappings will transform data.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Sample Data</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as MappingDirection)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="output">Output</SelectItem>
                  <SelectItem value="input">Input</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={sampleData}
              onChange={(e) => setSampleData(e.target.value)}
              className="h-64 font-mono text-xs"
              placeholder='{"key": "value"}'
            />
          </div>

          {/* Output */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Transformed Result</Label>
              {result && (
                <Button variant="ghost" size="sm" onClick={copyResult}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              )}
            </div>
            <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3">
              {error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              ) : result ? (
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Click &quot;Run Preview&quot; to see results
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={handlePreview} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run Preview
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
