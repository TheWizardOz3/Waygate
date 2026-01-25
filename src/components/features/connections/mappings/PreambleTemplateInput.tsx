'use client';

import { useState, useEffect, useMemo } from 'react';
import { Info, Sparkles, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useConnection, useUpdateConnection } from '@/hooks';
import { toast } from 'sonner';
import {
  VALID_TEMPLATE_VARIABLES,
  validatePreambleTemplate,
  interpolatePreamble,
  type PreambleContext,
} from '@/lib/modules/execution/preamble';

interface PreambleTemplateInputProps {
  connectionId: string;
  integrationId: string;
  integrationName?: string;
  integrationSlug?: string;
}

/**
 * Input component for configuring LLM response preamble templates
 */
export function PreambleTemplateInput({
  connectionId,
  integrationId,
  integrationName = 'Integration',
  integrationSlug = 'integration',
}: PreambleTemplateInputProps) {
  const { data: connection } = useConnection(connectionId);
  const updateMutation = useUpdateConnection(integrationId);

  const [template, setTemplate] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Sync with connection data
  useEffect(() => {
    if (connection?.preambleTemplate !== undefined) {
      setTemplate(connection.preambleTemplate ?? '');
      setIsDirty(false);
    }
  }, [connection?.preambleTemplate]);

  // Validate template
  const invalidVariables = useMemo(() => {
    if (!template) return [];
    return validatePreambleTemplate(template);
  }, [template]);

  const isValid = invalidVariables.length === 0;

  // Generate preview with sample data
  const preview = useMemo(() => {
    if (!template || !isValid) return null;

    const sampleContext: PreambleContext = {
      integrationName: integrationName,
      integrationSlug: integrationSlug,
      actionName: 'Search Records',
      actionSlug: 'search-records',
      connectionName: connection?.name ?? 'Default',
      resultCount: 42,
    };

    return interpolatePreamble(template, sampleContext);
  }, [template, isValid, integrationName, integrationSlug, connection?.name]);

  const handleSave = async () => {
    if (!isValid) return;

    try {
      await updateMutation.mutateAsync({
        id: connectionId,
        preambleTemplate: template || null, // Save null if empty
      });
      setIsDirty(false);
      toast.success('Preamble template saved');
    } catch (error) {
      toast.error('Failed to save preamble template', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  const handleClear = async () => {
    try {
      await updateMutation.mutateAsync({
        id: connectionId,
        preambleTemplate: null,
      });
      setTemplate('');
      setIsDirty(false);
      toast.success('Preamble template cleared');
    } catch (error) {
      toast.error('Failed to clear preamble template', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  const insertVariable = (variable: string) => {
    setTemplate((prev) => prev + `{${variable}}`);
    setIsDirty(true);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-base">LLM Response Format</CardTitle>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Add a context string to API responses to help LLMs understand the data. This is
                applied <strong>after</strong> field mappings.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <CardDescription>Configure a preamble template for LLM-friendly responses</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Template Input */}
        <div className="space-y-2">
          <Label htmlFor="preamble-template">Preamble Template</Label>
          <Textarea
            id="preamble-template"
            value={template}
            onChange={(e) => {
              setTemplate(e.target.value);
              setIsDirty(true);
            }}
            placeholder="The {action_name} results from {integration_name} are:"
            className="min-h-20 font-mono text-sm"
          />

          {/* Validation Error */}
          {!isValid && template && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>
                Invalid variable{invalidVariables.length > 1 ? 's' : ''}:{' '}
                {invalidVariables.map((v) => `{${v}}`).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Available Variables */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Available Variables</Label>
          <div className="flex flex-wrap gap-1.5">
            {VALID_TEMPLATE_VARIABLES.map((variable) => (
              <Badge
                key={variable}
                variant="outline"
                className="cursor-pointer font-mono text-xs hover:bg-muted"
                onClick={() => insertVariable(variable)}
              >
                {`{${variable}}`}
              </Badge>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        {preview && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preview (with sample data)</Label>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-sm italic text-muted-foreground">&quot;{preview}&quot;</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-2">
            {isDirty && isValid && (
              <Badge variant="outline" className="gap-1 text-xs text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Unsaved changes
              </Badge>
            )}
            {!isDirty && connection?.preambleTemplate && (
              <Badge variant="outline" className="gap-1 text-xs text-emerald-600">
                <Check className="h-3 w-3" />
                Saved
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            {connection?.preambleTemplate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={updateMutation.isPending}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || !isValid || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save Template
            </Button>
          </div>
        </div>

        {/* Explainer */}
        {!template && (
          <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-center">
            <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No preamble configured. Responses will return raw JSON data.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add a template like: &quot;The {'{action_name}'} results from {'{integration_name}'}{' '}
              are:&quot;
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
