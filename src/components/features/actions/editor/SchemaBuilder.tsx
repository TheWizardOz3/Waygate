'use client';

import { useState, useCallback } from 'react';
import { Plus, Code2, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SchemaFieldRow } from './SchemaFieldRow';
import { JsonSchemaEditor } from './JsonSchemaEditor';
import type { SchemaField } from './types';
import { schemaToFields, fieldsToSchema } from './types';
import type { JsonSchema } from '@/lib/modules/actions/action.schemas';

interface SchemaBuilderProps {
  title: string;
  description: string;
  schema: JsonSchema;
  onChange: (schema: JsonSchema) => void;
}

export function SchemaBuilder({ title, description, schema, onChange }: SchemaBuilderProps) {
  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [fields, setFields] = useState<SchemaField[]>(() => schemaToFields(schema));

  const updateFields = useCallback(
    (newFields: SchemaField[]) => {
      setFields(newFields);
      onChange(fieldsToSchema(newFields));
    },
    [onChange]
  );

  const handleAddField = () => {
    const newField: SchemaField = {
      id: crypto.randomUUID(),
      name: '',
      type: 'string',
      required: false,
      description: '',
    };
    updateFields([...fields, newField]);
  };

  const handleUpdateField = (id: string, updates: Partial<SchemaField>) => {
    updateFields(fields.map((field) => (field.id === id ? { ...field, ...updates } : field)));
  };

  const handleRemoveField = (id: string) => {
    updateFields(fields.filter((field) => field.id !== id));
  };

  const handleJsonChange = (newSchema: JsonSchema) => {
    setFields(schemaToFields(newSchema));
    onChange(newSchema);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'visual' | 'json')}>
            <TabsList className="h-8">
              <TabsTrigger value="visual" className="h-7 gap-1.5 px-3">
                <Table2 className="h-3.5 w-3.5" />
                Visual
              </TabsTrigger>
              <TabsTrigger value="json" className="h-7 gap-1.5 px-3">
                <Code2 className="h-3.5 w-3.5" />
                JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} className="w-full">
          <TabsContent value="visual" className="mt-0">
            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center">
                <p className="mb-4 text-sm text-muted-foreground">No fields defined yet</p>
                <Button variant="outline" onClick={handleAddField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30px]"></TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[140px]">Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-[80px] text-center">Required</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field) => (
                        <SchemaFieldRow
                          key={field.id}
                          field={field}
                          onUpdate={handleUpdateField}
                          onRemove={handleRemoveField}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button variant="outline" size="sm" onClick={handleAddField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="json" className="mt-0">
            <JsonSchemaEditor schema={schema} onChange={handleJsonChange} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
