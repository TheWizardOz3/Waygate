'use client';

import { UseFormReturn, FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SettingsTabProps {
  form: UseFormReturn<FieldValues>;
}

export function SettingsTab({ form }: SettingsTabProps) {
  const cacheable = form.watch('cacheable');
  const retryConfig = form.watch('retryConfig');
  const validationConfig = form.watch('validationConfig');
  const validationEnabled = validationConfig?.enabled ?? true;
  const validationMode = validationConfig?.mode ?? 'warn';
  const driftEnabled = validationConfig?.driftDetection?.enabled ?? true;

  const updateValidationConfig = (updates: Record<string, unknown>) => {
    const current = form.getValues('validationConfig') || {};
    form.setValue('validationConfig', {
      enabled: true,
      mode: 'warn',
      nullHandling: 'pass',
      extraFields: 'preserve',
      coercion: {
        stringToNumber: true,
        numberToString: true,
        stringToBoolean: true,
        emptyStringToNull: false,
        nullToDefault: true,
      },
      driftDetection: {
        enabled: true,
        windowMinutes: 60,
        failureThreshold: 5,
        alertOnDrift: true,
      },
      bypassValidation: false,
      ...current,
      ...updates,
    });
  };

  return (
    <div className="space-y-6">
      {/* Response Validation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Response Validation</CardTitle>
              <CardDescription>
                Validate API responses against your output schema
              </CardDescription>
            </div>
            <Switch
              checked={validationEnabled}
              onCheckedChange={(checked) => updateValidationConfig({ enabled: checked })}
            />
          </div>
        </CardHeader>
        {validationEnabled && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Label className="min-w-20">Mode</Label>
              <Select
                value={validationMode}
                onValueChange={(value) => updateValidationConfig({ mode: value })}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">Warn</Badge>
                      <span className="text-xs text-muted-foreground">Log issues, pass data</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="strict">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-red-500/10 text-red-600">Strict</Badge>
                      <span className="text-xs text-muted-foreground">Fail on mismatch</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="lenient">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600">Lenient</Badge>
                      <span className="text-xs text-muted-foreground">Auto-coerce types</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Drift Detection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Schema Drift Detection</Label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Monitors validation failures over time to detect when the external API changes its response format
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={driftEnabled}
                  onCheckedChange={(checked) =>
                    updateValidationConfig({
                      driftDetection: {
                        ...validationConfig?.driftDetection,
                        enabled: checked,
                      },
                    })
                  }
                />
              </div>
              {driftEnabled && (
                <div className="grid grid-cols-2 gap-4 pl-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Time Window</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={5}
                        max={1440}
                        value={validationConfig?.driftDetection?.windowMinutes ?? 60}
                        onChange={(e) =>
                          updateValidationConfig({
                            driftDetection: {
                              ...validationConfig?.driftDetection,
                              windowMinutes: parseInt(e.target.value, 10) || 60,
                            },
                          })
                        }
                        className="h-8 w-20"
                      />
                      <span className="text-xs text-muted-foreground">minutes</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Alert after</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={validationConfig?.driftDetection?.failureThreshold ?? 5}
                        onChange={(e) =>
                          updateValidationConfig({
                            driftDetection: {
                              ...validationConfig?.driftDetection,
                              failureThreshold: parseInt(e.target.value, 10) || 5,
                            },
                          })
                        }
                        className="h-8 w-20"
                      />
                      <span className="text-xs text-muted-foreground">failures</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Caching */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Response Caching</CardTitle>
              <CardDescription>
                Cache identical requests to reduce API calls and improve performance
              </CardDescription>
            </div>
            <FormField
              control={form.control}
              name="cacheable"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </CardHeader>
        {cacheable && (
          <CardContent>
            <FormField
              control={form.control}
              name="cacheTtlSeconds"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center gap-4">
                    <Label className="min-w-20">TTL</Label>
                    <div className="flex items-center gap-2">
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
                          className="h-8 w-24"
                        />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">seconds</span>
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        )}
      </Card>

      {/* Retry Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Automatic Retries</CardTitle>
              <CardDescription>
                Retry failed requests on specific error codes (e.g., rate limits, server errors)
              </CardDescription>
            </div>
            <FormField
              control={form.control}
              name="retryConfig"
              render={({ field }) => (
                <FormItem>
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
          </div>
        </CardHeader>
        {retryConfig && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="retryConfig.maxRetries"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-1">
                      <Label className="text-sm">Max Retries</Label>
                      <p className="text-xs text-muted-foreground">
                        How many times to retry before failing
                      </p>
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                        className="w-24"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="retryConfig.retryableStatuses"
                render={({ field }) => (
                  <FormItem>
                    <div className="space-y-1">
                      <Label className="text-sm">Status Codes to Retry</Label>
                      <p className="text-xs text-muted-foreground">
                        HTTP codes that trigger a retry
                      </p>
                    </div>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">
                <strong>How it works:</strong> When the API returns one of these status codes, Waygate will automatically retry the request with exponential backoff. Common codes: 429 (rate limit), 500-504 (server errors).
              </p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

