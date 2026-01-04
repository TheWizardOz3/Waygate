'use client';

import { UseFormReturn, FieldValues } from 'react-hook-form';
import { AlertTriangle, Check, Shield, ShieldAlert, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ValidationSettingsProps {
  form: UseFormReturn<FieldValues>;
}

/**
 * Validation mode descriptions for the UI
 */
const VALIDATION_MODES = {
  strict: {
    icon: ShieldAlert,
    label: 'Strict',
    description:
      "Fail if response doesn't match schema exactly. Best for production-critical data.",
    color: 'text-red-500',
  },
  warn: {
    icon: AlertTriangle,
    label: 'Warn',
    description:
      'Log issues but pass data through. Default - good balance of safety and flexibility.',
    color: 'text-yellow-500',
  },
  lenient: {
    icon: Zap,
    label: 'Lenient',
    description: 'Coerce types automatically, use defaults for nulls. Best for prototyping.',
    color: 'text-blue-500',
  },
};

export function ValidationSettings({ form }: ValidationSettingsProps) {
  const validationConfig = form.watch('validationConfig');
  const enabled = validationConfig?.enabled ?? true;
  const mode = validationConfig?.mode ?? 'warn';
  const driftEnabled = validationConfig?.driftDetection?.enabled ?? true;

  // Helper to update nested validation config
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
    <Accordion type="single" collapsible className="w-full">
      {/* Response Validation */}
      <AccordionItem value="validation">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Response Validation</span>
            {enabled && (
              <Badge variant="outline" className="ml-2">
                {mode}
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Response Validation</Label>
              <p className="text-sm text-muted-foreground">
                Validate API responses against the output schema
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) => updateValidationConfig({ enabled: checked })}
            />
          </div>

          {enabled && (
            <>
              {/* Mode Selection */}
              <div className="space-y-3">
                <Label>Validation Mode</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(value) => updateValidationConfig({ mode: value })}
                  className="grid gap-3"
                >
                  {Object.entries(VALIDATION_MODES).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <div key={key} className="relative">
                        <RadioGroupItem
                          value={key}
                          id={`validation-mode-${key}`}
                          className="peer sr-only"
                        />
                        <label
                          htmlFor={`validation-mode-${key}`}
                          className="flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                        >
                          <Icon className={`h-5 w-5 ${config.color}`} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{config.label}</span>
                              {mode === key && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{config.description}</p>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              {/* Mode-specific info */}
              {mode === 'strict' && (
                <Alert>
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription>
                    Strict mode will return an error if the API response doesn&apos;t match the
                    output schema. Make sure your schema accurately reflects the API&apos;s response
                    format.
                  </AlertDescription>
                </Alert>
              )}

              {/* Lenient Mode Coercion Settings */}
              {mode === 'lenient' && (
                <div className="space-y-4 rounded-lg border p-4">
                  <h4 className="text-sm font-medium">Type Coercion Settings</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">String → Number</Label>
                      <Switch
                        checked={validationConfig?.coercion?.stringToNumber ?? true}
                        onCheckedChange={(checked) =>
                          updateValidationConfig({
                            coercion: {
                              ...validationConfig?.coercion,
                              stringToNumber: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Number → String</Label>
                      <Switch
                        checked={validationConfig?.coercion?.numberToString ?? true}
                        onCheckedChange={(checked) =>
                          updateValidationConfig({
                            coercion: {
                              ...validationConfig?.coercion,
                              numberToString: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">String → Boolean</Label>
                      <Switch
                        checked={validationConfig?.coercion?.stringToBoolean ?? true}
                        onCheckedChange={(checked) =>
                          updateValidationConfig({
                            coercion: {
                              ...validationConfig?.coercion,
                              stringToBoolean: checked,
                            },
                          })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-normal">Null → Default</Label>
                      <Switch
                        checked={validationConfig?.coercion?.nullToDefault ?? true}
                        onCheckedChange={(checked) =>
                          updateValidationConfig({
                            coercion: {
                              ...validationConfig?.coercion,
                              nullToDefault: checked,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Drift Detection */}
      <AccordionItem value="drift">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>Schema Drift Detection</span>
            {driftEnabled && (
              <Badge variant="outline" className="ml-2">
                Active
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pt-4">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label className="text-base">Enable Drift Detection</Label>
              <p className="text-sm text-muted-foreground">
                Track validation failures over time to detect when the API changes
              </p>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="windowMinutes">Time Window (minutes)</Label>
                <Input
                  id="windowMinutes"
                  type="number"
                  min={5}
                  max={1440}
                  placeholder="60"
                  value={validationConfig?.driftDetection?.windowMinutes ?? 60}
                  onChange={(e) =>
                    updateValidationConfig({
                      driftDetection: {
                        ...validationConfig?.driftDetection,
                        windowMinutes: parseInt(e.target.value, 10) || 60,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">How long to track failures</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="failureThreshold">Failure Threshold</Label>
                <Input
                  id="failureThreshold"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="5"
                  value={validationConfig?.driftDetection?.failureThreshold ?? 5}
                  onChange={(e) =>
                    updateValidationConfig({
                      driftDetection: {
                        ...validationConfig?.driftDetection,
                        failureThreshold: parseInt(e.target.value, 10) || 5,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">Failures before alerting</p>
              </div>

              <div className="flex items-center justify-between md:col-span-2">
                <div className="space-y-0.5">
                  <Label className="text-sm font-normal">Alert on Drift</Label>
                  <p className="text-sm text-muted-foreground">
                    Send alerts when drift is detected
                  </p>
                </div>
                <Switch
                  checked={validationConfig?.driftDetection?.alertOnDrift ?? true}
                  onCheckedChange={(checked) =>
                    updateValidationConfig({
                      driftDetection: {
                        ...validationConfig?.driftDetection,
                        alertOnDrift: checked,
                      },
                    })
                  }
                />
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
