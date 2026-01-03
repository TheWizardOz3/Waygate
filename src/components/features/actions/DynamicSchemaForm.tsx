'use client';

import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Play, Loader2 } from 'lucide-react';
import type { JsonSchema, JsonSchemaProperty } from '@/lib/modules/actions/action.schemas';

interface DynamicSchemaFormProps {
  schema: JsonSchema;
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading?: boolean;
  defaultValues?: Record<string, unknown>;
}

export function DynamicSchemaForm({
  schema,
  onSubmit,
  isLoading,
  defaultValues,
}: DynamicSchemaFormProps) {
  const form = useForm({
    defaultValues: defaultValues || getDefaultValuesFromSchema(schema),
  });

  // Reset form when default values change
  useEffect(() => {
    if (defaultValues) {
      form.reset(defaultValues);
    }
  }, [defaultValues, form]);

  const properties = schema.properties || {};
  const required = schema.required || [];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {Object.entries(properties).map(([fieldName, fieldSchema]) => (
          <SchemaField
            key={fieldName}
            name={fieldName}
            schema={fieldSchema}
            required={required.includes(fieldName)}
            form={form}
          />
        ))}

        {Object.keys(properties).length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No parameters required for this action
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Execute Action
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}

interface SchemaFieldProps {
  name: string;
  schema: JsonSchemaProperty;
  required: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: ReturnType<typeof useForm<any>>;
  parentPath?: string;
}

function SchemaField({ name, schema, required, form, parentPath }: SchemaFieldProps) {
  const fieldPath = parentPath ? `${parentPath}.${name}` : name;
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  // Handle enum fields
  if (schema.enum && schema.enum.length > 0) {
    return (
      <FormField
        control={form.control}
        name={fieldPath}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {name}
              {required && <span className="ml-1 text-destructive">*</span>}
            </FormLabel>
            <Select onValueChange={field.onChange} value={String(field.value ?? '')}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${name}`} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {schema.enum!.map((option) => (
                  <SelectItem key={String(option)} value={String(option)}>
                    {String(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {schema.description && <FormDescription>{schema.description}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }

  // Handle by type
  switch (fieldType) {
    case 'boolean':
      return (
        <FormField
          control={form.control}
          name={fieldPath}
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>
                  {name}
                  {required && <span className="ml-1 text-destructive">*</span>}
                </FormLabel>
                {schema.description && <FormDescription>{schema.description}</FormDescription>}
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      );

    case 'number':
    case 'integer':
      return (
        <FormField
          control={form.control}
          name={fieldPath}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {name}
                {required && <span className="ml-1 text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder={
                    schema.default !== undefined ? String(schema.default) : `Enter ${name}`
                  }
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === '' ? undefined : Number(value));
                  }}
                />
              </FormControl>
              {schema.description && <FormDescription>{schema.description}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      );

    case 'array':
      return (
        <ArrayField
          name={name}
          schema={schema}
          required={required}
          form={form}
          parentPath={parentPath}
        />
      );

    case 'object':
      return (
        <ObjectField
          name={name}
          schema={schema}
          required={required}
          form={form}
          parentPath={parentPath}
        />
      );

    case 'string':
    default:
      // Check if it should be a textarea (long text)
      const isLongText = schema.maxLength && schema.maxLength > 200;

      return (
        <FormField
          control={form.control}
          name={fieldPath}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {name}
                {required && <span className="ml-1 text-destructive">*</span>}
              </FormLabel>
              <FormControl>
                {isLongText ? (
                  <Textarea
                    placeholder={
                      schema.default !== undefined ? String(schema.default) : `Enter ${name}`
                    }
                    className="min-h-[80px]"
                    {...field}
                  />
                ) : (
                  <Input
                    type={schema.format === 'password' ? 'password' : 'text'}
                    placeholder={
                      schema.default !== undefined ? String(schema.default) : `Enter ${name}`
                    }
                    {...field}
                  />
                )}
              </FormControl>
              {schema.description && <FormDescription>{schema.description}</FormDescription>}
              <FormMessage />
            </FormItem>
          )}
        />
      );
  }
}

function ArrayField({ name, schema, required, form, parentPath }: SchemaFieldProps) {
  const fieldPath = parentPath ? `${parentPath}.${name}` : name;
  const values = form.watch(fieldPath) || [];
  const itemSchema = schema.items || { type: 'string' };

  const addItem = () => {
    const defaultValue = getDefaultValue(itemSchema);
    form.setValue(fieldPath, [...values, defaultValue]);
  };

  const removeItem = (index: number) => {
    const newValues = values.filter((_: unknown, i: number) => i !== index);
    form.setValue(fieldPath, newValues);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <FormLabel>
          {name}
          {required && <span className="ml-1 text-destructive">*</span>}
        </FormLabel>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
      {schema.description && <FormDescription>{schema.description}</FormDescription>}

      {values.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No items added</p>
      ) : (
        <div className="space-y-2">
          {values.map((_: unknown, index: number) => (
            <div key={index} className="flex items-start gap-2">
              <div className="flex-1">
                <SchemaField
                  name={String(index)}
                  schema={itemSchema}
                  required={false}
                  form={form}
                  parentPath={fieldPath}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                className="mt-8"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObjectField({ name, schema, required, form, parentPath }: SchemaFieldProps) {
  const fieldPath = parentPath ? `${parentPath}.${name}` : name;
  const properties = schema.properties || {};
  const requiredFields = schema.required || [];

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <FormLabel>
        {name}
        {required && <span className="ml-1 text-destructive">*</span>}
      </FormLabel>
      {schema.description && <FormDescription>{schema.description}</FormDescription>}

      <div className="space-y-4 border-l-2 border-muted pl-4">
        {Object.entries(properties).map(([propName, propSchema]) => (
          <SchemaField
            key={propName}
            name={propName}
            schema={propSchema}
            required={requiredFields.includes(propName)}
            form={form}
            parentPath={fieldPath}
          />
        ))}
      </div>
    </div>
  );
}

function getDefaultValuesFromSchema(schema: JsonSchema): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  const properties = schema.properties || {};

  Object.entries(properties).forEach(([name, propSchema]) => {
    values[name] = getDefaultValue(propSchema);
  });

  return values;
}

function getDefaultValue(schema: JsonSchemaProperty): unknown {
  if (schema.default !== undefined) return schema.default;

  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case 'boolean':
      return false;
    case 'number':
    case 'integer':
      return undefined;
    case 'array':
      return [];
    case 'object':
      return schema.properties ? getDefaultValuesFromSchema(schema as JsonSchema) : {};
    case 'string':
    default:
      return '';
  }
}
