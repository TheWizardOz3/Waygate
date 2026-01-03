/**
 * Link Header Pagination Strategy (RFC 5988)
 *
 * Handles pagination via HTTP Link headers, commonly used by GitHub, GitLab,
 * and other APIs that follow RFC 5988 Web Linking standard.
 *
 * Example Link header:
 * Link: <https://api.example.com/items?page=2>; rel="next",
 *       <https://api.example.com/items?page=5>; rel="last"
 */

import type { PaginationConfig } from '../pagination.schemas';
import {
  BasePaginationStrategy,
  type PaginationContext,
  type PaginationParams,
  type ExtractedPaginationInfo,
  getArrayByPath,
  getNumberByPath,
} from './base.strategy';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed Link header entry
 */
interface ParsedLink {
  url: string;
  rel: string;
  [key: string]: string;
}

// =============================================================================
// Link Header Strategy Implementation
// =============================================================================

export class LinkHeaderPaginationStrategy extends BasePaginationStrategy {
  readonly strategyType = 'link_header' as const;
  readonly displayName = 'Link Header Pagination (RFC 5988)';

  // Store headers for extraction phase
  private lastHeaders: Record<string, string> = {};

  /**
   * Build request parameters for Link header pagination
   *
   * For Link header pagination, the cursor is the full URL to the next page.
   * If we have a cursor, we use it directly instead of modifying params.
   */
  buildRequestParams(context: PaginationContext): PaginationParams {
    const { config, cursor, pageSize } = context;
    const queryParams: Record<string, string | number> = {};

    // For first page, add page size if configured
    if (!cursor && config.limitParam) {
      queryParams[config.limitParam] = pageSize;
    }

    // Note: When cursor is present for Link header pagination,
    // the caller should use the cursor as the full URL
    // This is handled at a higher level in the pagination service

    return { queryParams };
  }

  /**
   * Set headers for extraction (called before extractPaginationInfo)
   */
  setHeaders(headers: Record<string, string>): void {
    this.lastHeaders = headers;
  }

  /**
   * Extract pagination info from Link header response
   */
  extractPaginationInfo(response: unknown, config: PaginationConfig): ExtractedPaginationInfo {
    // Extract data array from response body
    const items = getArrayByPath(response, config.dataPath);

    // Parse Link header
    const linkHeader = this.lastHeaders['link'] || this.lastHeaders['Link'] || '';
    const links = this.parseLinkHeader(linkHeader);

    // Find next page URL
    const nextLink = links.find((link) => link.rel === 'next');
    const nextCursor = nextLink?.url ?? null;

    // Determine if more pages exist
    const hasMore = nextCursor !== null;

    // Try to extract total from X-Total-Count or similar headers
    let totalItems: number | undefined;
    const totalHeader =
      this.lastHeaders['x-total-count'] ||
      this.lastHeaders['X-Total-Count'] ||
      this.lastHeaders['x-total'] ||
      this.lastHeaders['X-Total'];

    if (totalHeader) {
      const parsed = parseInt(totalHeader, 10);
      if (!isNaN(parsed)) {
        totalItems = parsed;
      }
    }

    // Also check response body for total
    if (totalItems === undefined) {
      totalItems = getNumberByPath(response, config.totalPath);
    }

    // Calculate total pages from last link if available
    let totalPages: number | undefined;
    const lastLink = links.find((link) => link.rel === 'last');
    if (lastLink) {
      const pageMatch = lastLink.url.match(/[?&]page=(\d+)/);
      if (pageMatch) {
        totalPages = parseInt(pageMatch[1], 10);
      }
    }

    return {
      items,
      nextCursor,
      hasMore,
      totalItems,
      totalPages,
    };
  }

  /**
   * Detect if response uses Link header pagination
   */
  detectStrategy(_response: unknown, headers: Record<string, string>): number {
    const linkHeader = headers['link'] || headers['Link'];

    if (!linkHeader) {
      return 0;
    }

    // Check if it contains rel="next" or rel='next'
    if (
      linkHeader.includes('rel="next"') ||
      linkHeader.includes("rel='next'") ||
      linkHeader.includes('rel=next')
    ) {
      return 1.0; // Very confident
    }

    // Has Link header but no next relation
    if (linkHeader.includes('rel=')) {
      return 0.5;
    }

    return 0.2;
  }

  /**
   * Parse Link header into structured links
   *
   * Format: <url1>; rel="next", <url2>; rel="last"
   */
  private parseLinkHeader(header: string): ParsedLink[] {
    if (!header || header.trim() === '') {
      return [];
    }

    const links: ParsedLink[] = [];

    // Split by comma (but not commas inside angle brackets)
    const linkParts = this.splitLinks(header);

    for (const part of linkParts) {
      const link = this.parseLink(part.trim());
      if (link) {
        links.push(link);
      }
    }

    return links;
  }

  /**
   * Split Link header by links (handling commas in URLs)
   */
  private splitLinks(header: string): string[] {
    const links: string[] = [];
    let current = '';
    let inAngleBrackets = false;

    for (const char of header) {
      if (char === '<') {
        inAngleBrackets = true;
        current += char;
      } else if (char === '>') {
        inAngleBrackets = false;
        current += char;
      } else if (char === ',' && !inAngleBrackets) {
        if (current.trim()) {
          links.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      links.push(current.trim());
    }

    return links;
  }

  /**
   * Parse a single link entry
   * Format: <url>; rel="next"; title="Next Page"
   */
  private parseLink(linkStr: string): ParsedLink | null {
    // Extract URL from angle brackets
    const urlMatch = linkStr.match(/<([^>]+)>/);
    if (!urlMatch) {
      return null;
    }

    const url = urlMatch[1];
    const link: ParsedLink = { url, rel: '' };

    // Extract parameters after the URL
    const paramsPart = linkStr.slice(urlMatch[0].length);
    const params = paramsPart.split(';');

    for (const param of params) {
      const trimmed = param.trim();
      if (!trimmed) continue;

      // Parse key="value" or key='value' or key=value
      const match = trimmed.match(/^(\w+)=["']?([^"']+)["']?$/);
      if (match) {
        const [, key, value] = match;
        link[key.toLowerCase()] = value;
      }
    }

    return link;
  }

  /**
   * Check if a URL is a valid next page URL
   */
  isValidNextUrl(url: string | null): boolean {
    if (!url) return false;

    try {
      new URL(url);
      return true;
    } catch {
      // Might be a relative URL
      return url.startsWith('/') || url.startsWith('?');
    }
  }

  /**
   * Extract page number from a URL (for debugging/logging)
   */
  extractPageFromUrl(url: string): number | null {
    const match = url.match(/[?&]page=(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const linkHeaderStrategy = new LinkHeaderPaginationStrategy();
