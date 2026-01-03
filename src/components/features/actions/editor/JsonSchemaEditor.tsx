'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { JsonSchema } from '@/lib/modules/actions/action.schemas';

interface JsonSchemaEditorProps {
  schema: JsonSchema;
  onChange: (schema: JsonSchema) => void;
}

export function JsonSchemaEditor({ schema, onChange }: JsonSchemaEditorProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(schema, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);

  // Update text when schema prop changes
  useEffect(() => {
    setJsonText(JSON.stringify(schema, null, 2));
  }, [schema]);

  const handleChange = useCallback(
    (value: string) => {
      setJsonText(value);

      try {
        const parsed = JSON.parse(value) as JsonSchema;

        // Basic validation
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('Schema must be an object');
        }

        if (parsed.type !== 'object' && parsed.type !== 'array') {
          throw new Error('Root type must be "object" or "array"');
        }

        setError(null);
        setIsValid(true);
        onChange(parsed);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid JSON');
        setIsValid(false);
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          value={jsonText}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange(e.target.value)}
          className="min-h-[300px] resize-y font-mono text-sm"
          spellCheck={false}
        />
        {isValid && (
          <div className="absolute right-2 top-2">
            <div className="flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600">
              <Check className="h-3 w-3" />
              Valid
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
