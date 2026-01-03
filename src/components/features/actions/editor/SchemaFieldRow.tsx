'use client';

import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import type { SchemaField } from './types';

interface SchemaFieldRowProps {
  field: SchemaField;
  onUpdate: (id: string, updates: Partial<SchemaField>) => void;
  onRemove: (id: string) => void;
}

const FIELD_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
] as const;

export function SchemaFieldRow({ field, onUpdate, onRemove }: SchemaFieldRowProps) {
  return (
    <TableRow>
      <TableCell className="w-[30px]">
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
      </TableCell>
      <TableCell>
        <Input
          value={field.name}
          onChange={(e) => onUpdate(field.id, { name: e.target.value })}
          placeholder="field_name"
          className="h-8 font-mono"
        />
      </TableCell>
      <TableCell className="w-[140px]">
        <Select
          value={field.type}
          onValueChange={(value) => onUpdate(field.id, { type: value as SchemaField['type'] })}
        >
          <SelectTrigger className="h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          value={field.description ?? ''}
          onChange={(e) => onUpdate(field.id, { description: e.target.value })}
          placeholder="Description"
          className="h-8"
        />
      </TableCell>
      <TableCell className="w-[80px] text-center">
        <Checkbox
          checked={field.required}
          onCheckedChange={(checked) => onUpdate(field.id, { required: !!checked })}
        />
      </TableCell>
      <TableCell className="w-[50px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(field.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
