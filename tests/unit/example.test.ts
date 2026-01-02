import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    const result = cn('px-4', 'py-2', 'bg-primary');
    expect(result).toBe('px-4 py-2 bg-primary');
  });

  it('handles conditional classes', () => {
    const isActive = true;
    const result = cn('base-class', isActive && 'active-class');
    expect(result).toBe('base-class active-class');
  });

  it('merges conflicting Tailwind classes correctly', () => {
    const result = cn('px-4', 'px-8');
    expect(result).toBe('px-8');
  });
});
