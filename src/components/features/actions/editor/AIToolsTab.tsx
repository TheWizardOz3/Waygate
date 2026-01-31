'use client';

import { useState } from 'react';
import { UseFormReturn, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Database, RefreshCw, Info, Plus, X, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface AIToolsTabProps {
  form: UseFormReturn<FieldValues>;
  integrationName?: string;
  onRegenerateToolDescriptions?: () => Promise<void>;
}

// Available variables for success template
const SUCCESS_TEMPLATE_VARIABLES = [
  { name: 'action_name', description: 'Name of the action executed' },
  { name: 'resource_type', description: 'Type of resource affected' },
  { name: 'key_id', description: 'Unique identifier of the result' },
  { name: 'summary', description: 'Brief summary of what happened' },
];

// Available variables for error template
const ERROR_TEMPLATE_VARIABLES = [
  { name: 'error_type', description: 'Category of error' },
  { name: 'error_message', description: 'Detailed error message' },
  { name: 'remediation', description: 'Suggested steps to fix' },
];

export function AIToolsTab({
  form,
  integrationName,
  onRegenerateToolDescriptions,
}: AIToolsTabProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [newMetadataField, setNewMetadataField] = useState('');

  // AI Tool Configuration fields
  const toolDescription = form.watch('toolDescription');
  const toolSuccessTemplate = form.watch('toolSuccessTemplate');
  const toolErrorTemplate = form.watch('toolErrorTemplate');
  const hasStoredDescriptions = toolDescription || toolSuccessTemplate || toolErrorTemplate;

  // Reference Data Sync fields
  const referenceData = form.watch('metadata.referenceData');
  const syncEnabled = referenceData?.syncable ?? false;
  const metadataFields = referenceData?.metadataFields ?? [];

  const handleRegenerate = async () => {
    if (!onRegenerateToolDescriptions) return;
    setIsGenerating(true);
    try {
      await onRegenerateToolDescriptions();
    } finally {
      setIsGenerating(false);
    }
  };

  const updateReferenceData = (updates: Record<string, unknown>) => {
    const current = form.getValues('metadata.referenceData') || {};
    const metadata = form.getValues('metadata') || {};
    form.setValue(
      'metadata',
      {
        ...metadata,
        referenceData: {
          dataType: '',
          syncable: false,
          extractionPath: '',
          idField: 'id',
          nameField: 'name',
          metadataFields: [],
          defaultTtlSeconds: 86400, // Default: 1 day
          ...current,
          ...updates,
        },
      },
      { shouldDirty: true, shouldTouch: true }
    );
  };

  const toggleSyncEnabled = (checked: boolean) => {
    if (checked) {
      updateReferenceData({ syncable: true });
    } else {
      // Clear reference data config when disabled
      const metadata = form.getValues('metadata') || {};
      form.setValue(
        'metadata',
        {
          ...metadata,
          referenceData: undefined,
        },
        { shouldDirty: true, shouldTouch: true }
      );
    }
  };

  const addMetadataField = () => {
    if (newMetadataField.trim() && !metadataFields.includes(newMetadataField.trim())) {
      updateReferenceData({
        metadataFields: [...metadataFields, newMetadataField.trim()],
      });
      setNewMetadataField('');
    }
  };

  const removeMetadataField = (field: string) => {
    updateReferenceData({
      metadataFields: metadataFields.filter((f: string) => f !== field),
    });
  };

  const insertSuccessVariable = (variable: string) => {
    const currentValue = form.getValues('toolSuccessTemplate') || '';
    form.setValue('toolSuccessTemplate', currentValue + `{{${variable}}}`, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  const insertErrorVariable = (variable: string) => {
    const currentValue = form.getValues('toolErrorTemplate') || '';
    form.setValue('toolErrorTemplate', currentValue + `{{${variable}}}`, {
      shouldDirty: true,
      shouldTouch: true,
    });
  };

  // Convert seconds to days for display
  const syncIntervalDays = Math.round((referenceData?.defaultTtlSeconds ?? 86400) / 86400);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">AI Tools</h2>
        <p className="text-sm text-muted-foreground">
          Configure how this action behaves when used by AI agents
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Section 1: AI Tool Description */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-violet-500" />
              <div>
                <h3 className="font-medium">Tool Description</h3>
                <p className="text-sm text-muted-foreground">
                  How AI agents understand and use this action
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasStoredDescriptions ? (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600">
                  Using defaults
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-6 pl-8">
            {/* Tool Description */}
            <FormField
              control={form.control}
              name="toolDescription"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Description</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The mini-prompt description shown to AI agents explaining what this tool
                        does, when to use it, and what inputs are required.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Use this tool to..."
                      className="min-h-[100px] font-mono text-xs"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use auto-generated descriptions based on action schema.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Success Response Template */}
            <FormField
              control={form.control}
              name="toolSuccessTemplate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Success Response Template</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Template for formatting successful responses. Use the available variables to
                        include dynamic content.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="## {{action_name}} completed&#10;&#10;{{summary}}&#10;&#10;ID: {{key_id}}"
                      className="min-h-[80px] font-mono text-xs"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  {/* Variable badges */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Available Variables</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {SUCCESS_TEMPLATE_VARIABLES.map((v) => (
                        <Tooltip key={v.name}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-pointer font-mono text-xs hover:bg-muted"
                              onClick={() => insertSuccessVariable(v.name)}
                            >
                              {`{{${v.name}}}`}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{v.description}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Response Template */}
            <FormField
              control={form.control}
              name="toolErrorTemplate"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Error Response Template</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Template for formatting error responses. Helps AI agents understand what
                        went wrong and how to recover.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="## {{error_type}} Error&#10;&#10;{{error_message}}&#10;&#10;**How to fix:**&#10;{{remediation}}"
                      className="min-h-[80px] font-mono text-xs"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  {/* Variable badges */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Available Variables</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {ERROR_TEMPLATE_VARIABLES.map((v) => (
                        <Tooltip key={v.name}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-pointer font-mono text-xs hover:bg-muted"
                              onClick={() => insertErrorVariable(v.name)}
                            >
                              {`{{${v.name}}}`}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{v.description}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Generate with AI */}
            {onRegenerateToolDescriptions && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">Generate with AI</p>
                  <p className="text-xs text-muted-foreground">
                    Create optimized descriptions based on
                    {integrationName ? ` ${integrationName}` : ''} action schema
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </section>

        <Separator />

        {/* Section 2: Reference Data Sync */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-blue-500" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">Reference Data Sync</h3>
                  <Badge variant="outline" className="text-xs">
                    AI Context
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cache response data so AI tools can resolve names to IDs
                </p>
              </div>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={toggleSyncEnabled} />
          </div>

          {syncEnabled && (
            <div className="space-y-6 pl-8">
              {/* Data Category */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Data Category</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      A label for this type of data (e.g., &quot;users&quot;, &quot;channels&quot;,
                      &quot;projects&quot;). This is used to group and identify cached items.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  placeholder="e.g., users, channels, projects"
                  value={referenceData?.dataType ?? ''}
                  onChange={(e) => updateReferenceData({ dataType: e.target.value })}
                  className="max-w-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Choose a descriptive name for this data type
                </p>
              </div>

              {/* JSONPath Extraction */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Response Path</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      JSONPath expression to extract the array of items from the API response. For
                      example, if the response is {`{ members: [...] }`}, use
                      <code className="mx-1 rounded bg-muted px-1">$.members[*]</code>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  placeholder="$.members[*] or $.data.items[*]"
                  value={referenceData?.extractionPath ?? ''}
                  onChange={(e) => updateReferenceData({ extractionPath: e.target.value })}
                  className="max-w-sm font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  JSONPath to the array of items in the response
                </p>
              </div>

              {/* Field Mapping */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">ID Field</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The field name in each item that contains the unique identifier.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    placeholder="id"
                    value={referenceData?.idField ?? 'id'}
                    onChange={(e) => updateReferenceData({ idField: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">Name Field</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        The field name in each item that contains the display name (what AI will use
                        for lookups).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    placeholder="name"
                    value={referenceData?.nameField ?? 'name'}
                    onChange={(e) => updateReferenceData({ nameField: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* Sync Interval */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Sync Frequency</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      How often to refresh this data from the API. More frequent syncing keeps data
                      fresh but uses more API calls.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={syncIntervalDays}
                    onChange={(e) => {
                      const days = parseInt(e.target.value, 10) || 1;
                      updateReferenceData({ defaultTtlSeconds: days * 86400 });
                    }}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">day(s)</span>
                </div>
              </div>

              {/* Additional Fields */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Additional Fields (Optional)</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Extra fields to store from each item. Useful for filtering or additional
                      context (e.g., email, is_admin, department).
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex flex-wrap gap-2">
                  {metadataFields.map((field: string) => (
                    <Badge key={field} variant="secondary" className="gap-1 font-mono text-xs">
                      {field}
                      <button
                        type="button"
                        onClick={() => removeMetadataField(field)}
                        className="ml-1 rounded-full hover:bg-destructive/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      placeholder="field_name"
                      value={newMetadataField}
                      onChange={(e) => setNewMetadataField(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addMetadataField();
                        }
                      }}
                      className="h-7 w-28 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addMetadataField}
                      className="h-7 w-7 p-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="flex items-start gap-3 rounded-lg border bg-blue-500/5 p-4">
                <RefreshCw className="h-5 w-5 shrink-0 text-blue-500" />
                <div className="text-sm">
                  <p className="font-medium">How Reference Data Sync Works</p>
                  <p className="mt-1 text-muted-foreground">
                    Waygate periodically calls this action and caches the extracted items. When AI
                    tools run, they can use this cached data to resolve human-friendly names to IDs
                    (e.g., &quot;@sarah&quot; → &quot;U123&quot; or &quot;#general&quot; →
                    &quot;C456&quot;).
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    <strong>Note:</strong> Data is synced per end-user connection. Each user who
                    connects will have their own cached reference data based on what they have
                    access to.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
