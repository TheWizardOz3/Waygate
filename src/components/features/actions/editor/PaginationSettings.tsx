'use client';

import { UseFormReturn, FieldValues } from 'react-hook-form';
import { AlertTriangle, Zap, Database, FlaskConical } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  DEFAULT_PAGINATION_LIMITS,
  PaginationPresets,
  estimateTokens,
  hasHighLimits,
} from '@/lib/modules/execution/pagination';

interface PaginationSettingsProps {
  form: UseFormReturn<FieldValues>;
}

/**
 * Pagination configuration panel for the action editor.
 * Allows configuring pagination strategy, limits, and LLM-friendly presets.
 */
export function PaginationSettings({ form }: PaginationSettingsProps) {
  const paginationEnabled = form.watch('paginationConfig.enabled');
  const strategy = form.watch('paginationConfig.strategy');
  const maxCharacters =
    form.watch('paginationConfig.maxCharacters') ?? DEFAULT_PAGINATION_LIMITS.maxCharacters;
  const maxPages = form.watch('paginationConfig.maxPages') ?? DEFAULT_PAGINATION_LIMITS.maxPages;
  const maxItems = form.watch('paginationConfig.maxItems') ?? DEFAULT_PAGINATION_LIMITS.maxItems;

  // Check if current config has high limits
  const currentConfig = form.watch('paginationConfig');
  const showHighLimitWarning =
    currentConfig &&
    hasHighLimits({
      enabled: true,
      strategy: 'auto',
      maxPages: maxPages,
      maxItems: maxItems,
      maxCharacters: maxCharacters,
      maxDurationMs: currentConfig.maxDurationMs ?? DEFAULT_PAGINATION_LIMITS.maxDurationMs,
      defaultPageSize: currentConfig.defaultPageSize ?? DEFAULT_PAGINATION_LIMITS.defaultPageSize,
    });

  // Apply preset to form
  const applyPreset = (presetName: keyof typeof PaginationPresets) => {
    const preset = PaginationPresets[presetName];
    form.setValue('paginationConfig.maxPages', preset.maxPages);
    form.setValue('paginationConfig.maxItems', preset.maxItems);
    form.setValue('paginationConfig.maxCharacters', preset.maxCharacters);
    form.setValue('paginationConfig.maxDurationMs', preset.maxDurationMs);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagination Settings</CardTitle>
        <CardDescription>
          Configure automatic pagination to fetch multiple pages of data with LLM-friendly limits
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Pagination Toggle */}
        <FormField
          control={form.control}
          name="paginationConfig.enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Enable Pagination</FormLabel>
                <FormDescription>
                  Automatically fetch multiple pages of data when pagination is supported
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked && !form.getValues('paginationConfig.strategy')) {
                      form.setValue('paginationConfig.strategy', 'auto');
                    }
                  }}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {paginationEnabled && (
          <>
            {/* Preset Buttons */}
            <div className="space-y-2">
              <FormLabel>Quick Presets</FormLabel>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('LLM_OPTIMIZED')}
                  className="gap-1.5"
                >
                  <Zap className="h-3.5 w-3.5" />
                  LLM-Optimized
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('FULL_DATASET')}
                  className="gap-1.5"
                >
                  <Database className="h-3.5 w-3.5" />
                  Full Dataset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset('QUICK_SAMPLE')}
                  className="gap-1.5"
                >
                  <FlaskConical className="h-3.5 w-3.5" />
                  Quick Sample
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                LLM-Optimized: ~25K tokens, Full Dataset: ~250K tokens, Quick Sample: ~2.5K tokens
              </p>
            </div>

            {/* High Limit Warning */}
            {showHighLimitWarning && (
              <Alert variant="destructive" className="border-orange-500/50 bg-orange-500/10">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <AlertDescription className="text-orange-700 dark:text-orange-300">
                  High limits configured. This may result in large responses that exceed LLM context
                  windows or cause timeouts. Consider using the &quot;LLM-Optimized&quot; preset for
                  AI-driven workflows.
                </AlertDescription>
              </Alert>
            )}

            {/* Strategy Selection */}
            <FormField
              control={form.control}
              name="paginationConfig.strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pagination Strategy</FormLabel>
                  <Select value={field.value ?? 'auto'} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="cursor">Cursor-based</SelectItem>
                      <SelectItem value="offset">Offset/Limit</SelectItem>
                      <SelectItem value="page_number">Page Number</SelectItem>
                      <SelectItem value="link_header">Link Header (RFC 5988)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How pagination is handled. Auto-detect works for most APIs.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Limits Section */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="limits">
                <AccordionTrigger>Safety Limits</AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="paginationConfig.maxPages"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Pages</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              placeholder={String(DEFAULT_PAGINATION_LIMITS.maxPages)}
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                              }
                            />
                          </FormControl>
                          <FormDescription>Max pages to fetch (1-100)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paginationConfig.maxItems"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Items</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              max={10000}
                              placeholder={String(DEFAULT_PAGINATION_LIMITS.maxItems)}
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                              }
                            />
                          </FormControl>
                          <FormDescription>Max items to fetch (1-10,000)</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paginationConfig.maxCharacters"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Characters</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1000}
                              max={1000000}
                              placeholder={String(DEFAULT_PAGINATION_LIMITS.maxCharacters)}
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            ~
                            {estimateTokens(
                              field.value ?? DEFAULT_PAGINATION_LIMITS.maxCharacters
                            ).toLocaleString()}{' '}
                            tokens
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paginationConfig.maxDurationMs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Max Duration (ms)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1000}
                              max={300000}
                              placeholder={String(DEFAULT_PAGINATION_LIMITS.maxDurationMs)}
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) =>
                                field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            {(field.value ?? DEFAULT_PAGINATION_LIMITS.maxDurationMs) / 1000}s
                            timeout
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="paginationConfig.defaultPageSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Default Page Size</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={500}
                            placeholder={String(DEFAULT_PAGINATION_LIMITS.defaultPageSize)}
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value, 10) : null)
                            }
                          />
                        </FormControl>
                        <FormDescription>Items per page when fetching (1-500)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </AccordionContent>
              </AccordionItem>

              {/* Strategy-specific settings */}
              {strategy && strategy !== 'auto' && (
                <AccordionItem value="strategy-config">
                  <AccordionTrigger>Strategy Configuration</AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {/* Cursor-based config */}
                    {strategy === 'cursor' && (
                      <>
                        <FormField
                          control={form.control}
                          name="paginationConfig.cursorParam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cursor Parameter Name</FormLabel>
                              <FormControl>
                                <Input placeholder="cursor" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>
                                Query parameter name for cursor (e.g., cursor, after, pageToken)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="paginationConfig.cursorPath"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cursor JSON Path</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="$.meta.next_cursor"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription>
                                JSONPath to the next cursor in the response
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Offset-based config */}
                    {strategy === 'offset' && (
                      <>
                        <FormField
                          control={form.control}
                          name="paginationConfig.offsetParam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Offset Parameter Name</FormLabel>
                              <FormControl>
                                <Input placeholder="offset" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>
                                Query parameter name for offset (e.g., offset, skip, start)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="paginationConfig.limitParam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Limit Parameter Name</FormLabel>
                              <FormControl>
                                <Input placeholder="limit" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>
                                Query parameter name for limit (e.g., limit, count, per_page)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Page number config */}
                    {strategy === 'page_number' && (
                      <>
                        <FormField
                          control={form.control}
                          name="paginationConfig.pageParam"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Page Parameter Name</FormLabel>
                              <FormControl>
                                <Input placeholder="page" {...field} value={field.value ?? ''} />
                              </FormControl>
                              <FormDescription>
                                Query parameter name for page number (e.g., page, p, pageNumber)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="paginationConfig.totalPagesPath"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Total Pages JSON Path</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="$.meta.total_pages"
                                  {...field}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormDescription>
                                JSONPath to total pages in the response (optional)
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Common config for all strategies */}
                    <FormField
                      control={form.control}
                      name="paginationConfig.dataPath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Array JSON Path</FormLabel>
                          <FormControl>
                            <Input placeholder="$.data" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormDescription>
                            JSONPath to the data array in the response (e.g., $.data, $.results,
                            $.items)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="paginationConfig.hasMorePath"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Has More JSON Path</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="$.meta.has_more"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormDescription>
                            JSONPath to boolean indicating more pages exist (optional)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              )}
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
}
