'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { JsonSchemaEditor } from './JsonSchemaEditor';
import type { JsonSchema } from '@/lib/modules/actions/action.schemas';

interface SchemaTabProps {
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  onInputChange: (schema: JsonSchema) => void;
  onOutputChange: (schema: JsonSchema) => void;
}

export function SchemaTab({
  inputSchema,
  outputSchema,
  onInputChange,
  onOutputChange,
}: SchemaTabProps) {
  const [activeSchema, setActiveSchema] = useState<'input' | 'output'>('input');

  const hasInputSchema = inputSchema && Object.keys(inputSchema.properties || {}).length > 0;
  const hasOutputSchema = outputSchema && Object.keys(outputSchema.properties || {}).length > 0;
  const inputCount = Object.keys(inputSchema?.properties || {}).length;
  const outputCount = Object.keys(outputSchema?.properties || {}).length;

  return (
    <div className="space-y-8">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">Request & Response Schema</h2>
        <p className="text-sm text-muted-foreground">
          Define the JSON schema for input parameters and expected response structure
        </p>
      </div>

      <Tabs value={activeSchema} onValueChange={(v) => setActiveSchema(v as 'input' | 'output')}>
        <TabsList className="mb-6 h-auto w-auto justify-start rounded-lg bg-muted/50 p-1">
          <TabsTrigger
            value="input"
            className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Input Schema
            {hasInputSchema && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {inputCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="output"
            className="gap-2 rounded-md px-4 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            Output Schema
            {hasOutputSchema && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5 text-xs">
                {outputCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="mt-0">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define the parameters this action accepts. These will be validated when the action is
              invoked.
            </p>
            <JsonSchemaEditor schema={inputSchema} onChange={onInputChange} />
          </div>
        </TabsContent>

        <TabsContent value="output" className="mt-0">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Define the expected response structure. Used for validation and drift detection.
            </p>
            <JsonSchemaEditor schema={outputSchema} onChange={onOutputChange} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
