'use client';

import { UseFormReturn, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EndpointTabProps {
  form: UseFormReturn<FieldValues>;
  isEditing: boolean;
  integrationSlug?: string;
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export function EndpointTab({ form, isEditing, integrationSlug }: EndpointTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Endpoint Configuration</CardTitle>
        <CardDescription>Define the API endpoint this action will call</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name & Slug */}
        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Send Message" {...field} />
                </FormControl>
                <FormDescription>Human-readable name for this action</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl>
                  <Input
                    placeholder="send-message"
                    {...field}
                    disabled={isEditing}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  {isEditing
                    ? 'Cannot be changed after creation'
                    : 'Auto-generated from name, or customize'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Method & Endpoint */}
        <div className="grid gap-4 md:grid-cols-4">
          <FormField
            control={form.control}
            name="httpMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Method</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {HTTP_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="endpointTemplate"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Endpoint Path</FormLabel>
                <FormControl>
                  <Input
                    placeholder="/api/messages/{channel_id}"
                    {...field}
                    className="font-mono"
                  />
                </FormControl>
                <FormDescription>
                  Path template. Use {'{param}'} for dynamic segments.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe what this action does..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>Optional description for documentation</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preview */}
        {integrationSlug && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Gateway Endpoint Preview</p>
            <code className="text-sm">
              POST /api/v1/gateway/{integrationSlug}/{form.watch('slug') || 'action-slug'}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

