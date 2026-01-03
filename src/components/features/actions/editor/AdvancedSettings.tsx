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
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface AdvancedSettingsProps {
  form: UseFormReturn<FieldValues>;
}

export function AdvancedSettings({ form }: AdvancedSettingsProps) {
  const cacheable = form.watch('cacheable');
  const retryConfig = form.watch('retryConfig');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced Settings</CardTitle>
        <CardDescription>Configure caching and retry behavior</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {/* Caching */}
          <AccordionItem value="caching">
            <AccordionTrigger>Caching</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="cacheable"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enable Caching</FormLabel>
                      <FormDescription>
                        Cache responses to reduce API calls for identical requests
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {cacheable && (
                <FormField
                  control={form.control}
                  name="cacheTtlSeconds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cache TTL (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={86400}
                          placeholder="300"
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        How long to cache responses (default: 300 seconds)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Retry Configuration */}
          <AccordionItem value="retry">
            <AccordionTrigger>Retry Configuration</AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <FormField
                control={form.control}
                name="retryConfig"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Custom Retry Settings</FormLabel>
                      <FormDescription>
                        Override default retry behavior for this action
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? { maxRetries: 3, retryableStatuses: [429, 500, 502, 503, 504] }
                              : null
                          )
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {retryConfig && (
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="retryConfig.maxRetries"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Retries</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                          />
                        </FormControl>
                        <FormDescription>Maximum retry attempts (0-10)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retryConfig.retryableStatuses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retryable Status Codes</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="429, 500, 502, 503, 504"
                            value={field.value?.join(', ') ?? ''}
                            onChange={(e) => {
                              const codes = e.target.value
                                .split(',')
                                .map((s) => parseInt(s.trim(), 10))
                                .filter((n) => !isNaN(n));
                              field.onChange(codes);
                            }}
                          />
                        </FormControl>
                        <FormDescription>Comma-separated HTTP status codes</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
