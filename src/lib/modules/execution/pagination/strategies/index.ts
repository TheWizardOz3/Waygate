/**
 * Pagination Strategies
 *
 * Strategy implementations for different pagination patterns.
 */

// =============================================================================
// Base Strategy
// =============================================================================

export {
  BasePaginationStrategy,
  getValueByPath,
  getArrayByPath,
  getStringByPath,
  getNumberByPath,
  getBooleanByPath,
  looksLikePaginatedResponse,
} from './base.strategy';

export type {
  PaginationContext,
  PaginationParams,
  ExtractedPaginationInfo,
  BuildRequestOptions,
} from './base.strategy';

// =============================================================================
// Strategy Implementations
// =============================================================================

export { CursorPaginationStrategy, cursorStrategy } from './cursor.strategy';
export { OffsetPaginationStrategy, offsetStrategy } from './offset.strategy';
export { PageNumberPaginationStrategy, pageNumberStrategy } from './page-number.strategy';
export { LinkHeaderPaginationStrategy, linkHeaderStrategy } from './link-header.strategy';

// =============================================================================
// Strategy Registry
// =============================================================================

import { cursorStrategy } from './cursor.strategy';
import { offsetStrategy } from './offset.strategy';
import { pageNumberStrategy } from './page-number.strategy';
import { linkHeaderStrategy } from './link-header.strategy';
import type { BasePaginationStrategy } from './base.strategy';
import type { PaginationStrategy } from '../pagination.schemas';

/**
 * Map of strategy type to implementation
 */
export const strategyRegistry: Record<
  Exclude<PaginationStrategy, 'auto'>,
  BasePaginationStrategy
> = {
  cursor: cursorStrategy,
  offset: offsetStrategy,
  page_number: pageNumberStrategy,
  link_header: linkHeaderStrategy,
};

/**
 * Get strategy instance by type
 */
export function getStrategy(strategyType: PaginationStrategy): BasePaginationStrategy | null {
  if (strategyType === 'auto') {
    return null; // Auto requires detection
  }
  return strategyRegistry[strategyType] ?? null;
}

/**
 * Get all available strategies for auto-detection
 */
export function getAllStrategies(): BasePaginationStrategy[] {
  return Object.values(strategyRegistry);
}
