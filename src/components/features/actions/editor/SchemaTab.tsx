'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Request & Response Schema</CardTitle>
        <CardDescription>
          Define the JSON schema for input parameters and expected response structure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeSchema} onValueChange={(v) => setActiveSchema(v as 'input' | 'output')}>
          <TabsList className="mb-4">
            <TabsTrigger value="input" className="gap-2">
              Input Schema
              {hasInputSchema && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">
                  {Object.keys(inputSchema.properties || {}).length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="output" className="gap-2">
              Output Schema
              {hasOutputSchema && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs">
                  {Object.keys(outputSchema.properties || {}).length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="mt-0">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Define the parameters this action accepts. These will be validated when the action is invoked.
              </p>
              <JsonSchemaEditor schema={inputSchema} onChange={onInputChange} />
            </div>
          </TabsContent>

          <TabsContent value="output" className="mt-0">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Define the expected response structure. Used for validation and drift detection.
              </p>
              <JsonSchemaEditor schema={outputSchema} onChange={onOutputChange} />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

