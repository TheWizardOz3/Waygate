/**
 * Parallel Scraper
 *
 * Scrapes multiple pages in parallel with controlled concurrency.
 * Used after triage to quickly fetch all prioritized pages.
 */

import { scrapeUrl } from './doc-scraper';
import type { PrioritizedPage } from './triage';

// =============================================================================
// Types
// =============================================================================

/**
 * Result of scraping a single page
 */
export interface ScrapedPage {
  /** The URL that was scraped */
  url: string;
  /** The scraped content (empty if failed) */
  content: string;
  /** Page title if available */
  title?: string;
  /** Whether the scrape succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Category from triage */
  category: PrioritizedPage['category'];
  /** Duration in ms */
  durationMs: number;
}

/**
 * Result of parallel scraping
 */
export interface ParallelScrapeResult {
  /** All scraped pages */
  pages: ScrapedPage[];
  /** Aggregated content from all successful pages */
  aggregatedContent: string;
  /** Number of successful scrapes */
  successCount: number;
  /** Number of failed scrapes */
  failedCount: number;
  /** Total duration in ms */
  durationMs: number;
}

/**
 * Options for parallel scraping
 */
export interface ParallelScrapeOptions {
  /** Maximum concurrent scrapes (default: 5) */
  concurrency?: number;
  /** Timeout per page in ms (default: 30000) */
  pageTimeout?: number;
  /** Whether to continue on individual page failures (default: true) */
  continueOnError?: boolean;
  /** Callback for progress updates */
  onProgress?: (scraped: number, total: number, currentUrl: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_PAGE_TIMEOUT = 30000;

/** Maximum content length per page (chars) - truncate beyond this */
const MAX_CONTENT_PER_PAGE = 100_000;

/** Maximum total aggregated content (chars) - ~200K tokens for LLM */
const MAX_TOTAL_CONTENT = 800_000;

// =============================================================================
// Parallel Scraper
// =============================================================================

/**
 * Scrape multiple pages in parallel with controlled concurrency
 *
 * @param pages - Prioritized pages from triage
 * @param options - Scraping options
 * @returns Scraped pages and aggregated content
 */
export async function scrapeInParallel(
  pages: PrioritizedPage[],
  options: ParallelScrapeOptions = {}
): Promise<ParallelScrapeResult> {
  const {
    concurrency = DEFAULT_CONCURRENCY,
    pageTimeout = DEFAULT_PAGE_TIMEOUT,
    continueOnError = true,
    onProgress,
  } = options;

  const startTime = Date.now();
  const results: ScrapedPage[] = [];
  let completedCount = 0;

  // Process pages in batches for controlled concurrency
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);

    const batchPromises = batch.map(async (page) => {
      const pageStart = Date.now();

      try {
        onProgress?.(completedCount, pages.length, page.url);

        const scrapeResult = await scrapeUrl(page.url, {
          timeout: pageTimeout,
          onlyMainContent: true,
        });

        completedCount++;

        return {
          url: page.url,
          content: scrapeResult.content,
          title: scrapeResult.title,
          success: true,
          category: page.category,
          durationMs: Date.now() - pageStart,
        } as ScrapedPage;
      } catch (error) {
        completedCount++;

        const errorResult: ScrapedPage = {
          url: page.url,
          content: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          category: page.category,
          durationMs: Date.now() - pageStart,
        };

        if (!continueOnError) {
          throw error;
        }

        return errorResult;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  // Report final progress
  onProgress?.(completedCount, pages.length, 'complete');

  // Build aggregated content (organized by category)
  const aggregatedContent = buildAggregatedContent(results);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return {
    pages: results,
    aggregatedContent,
    successCount,
    failedCount,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Truncate content to max length with indicator
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to truncate at a natural break point
  const truncateAt = content.lastIndexOf('\n', maxLength - 100);
  const cutPoint = truncateAt > maxLength * 0.8 ? truncateAt : maxLength - 100;

  return content.slice(0, cutPoint) + '\n\n[Content truncated - page exceeded limit]';
}

/**
 * Build aggregated content from scraped pages, organized by category
 * Respects MAX_CONTENT_PER_PAGE and MAX_TOTAL_CONTENT limits
 */
function buildAggregatedContent(pages: ScrapedPage[]): string {
  const successfulPages = pages.filter((p) => p.success && p.content);

  if (successfulPages.length === 0) {
    return '';
  }

  // Group by category
  const authPages = successfulPages.filter((p) => p.category === 'auth');
  const overviewPages = successfulPages.filter(
    (p) => p.category === 'overview' || p.category === 'getting_started'
  );
  const endpointPages = successfulPages.filter((p) => p.category === 'endpoint');
  const rateLimitPages = successfulPages.filter((p) => p.category === 'rate_limits');
  const otherPages = successfulPages.filter(
    (p) => !['auth', 'overview', 'getting_started', 'endpoint', 'rate_limits'].includes(p.category)
  );

  const sections: string[] = [];
  let totalLength = 0;
  let pagesIncluded = 0;
  let pagesTruncated = 0;
  let pagesSkipped = 0;

  // Helper to add page with limits
  const addPageWithLimits = (page: ScrapedPage): boolean => {
    // Check if we've hit total limit
    if (totalLength >= MAX_TOTAL_CONTENT) {
      pagesSkipped++;
      return false;
    }

    // Truncate page content if needed
    let content = page.content;
    if (content.length > MAX_CONTENT_PER_PAGE) {
      content = truncateContent(content, MAX_CONTENT_PER_PAGE);
      pagesTruncated++;
      console.log(
        `[Parallel Scraper] Truncated ${page.url} from ${page.content.length} to ${content.length} chars`
      );
    }

    // Check if adding this page would exceed total limit
    const pageSection = formatPageSection({ ...page, content });
    if (totalLength + pageSection.length > MAX_TOTAL_CONTENT) {
      // Truncate this section to fit remaining space
      const remaining = MAX_TOTAL_CONTENT - totalLength - 200; // Leave buffer
      if (remaining > 5000) {
        // Only include if meaningful amount remains
        const truncatedSection = truncateContent(pageSection, remaining);
        sections.push(truncatedSection);
        totalLength += truncatedSection.length;
        pagesIncluded++;
        pagesTruncated++;
      } else {
        pagesSkipped++;
      }
      return false; // Signal to stop adding
    }

    sections.push(pageSection);
    totalLength += pageSection.length;
    pagesIncluded++;
    return true;
  };

  // Header
  const header = '# API Documentation\n';
  sections.push(header);
  totalLength += header.length;

  // Authentication (first - critical, always include)
  if (authPages.length > 0) {
    sections.push('# Authentication\n');
    totalLength += 20;
    for (const page of authPages) {
      if (!addPageWithLimits(page)) break;
    }
  }

  // Overview / Getting Started
  if (overviewPages.length > 0 && totalLength < MAX_TOTAL_CONTENT) {
    sections.push('# API Overview\n');
    totalLength += 16;
    for (const page of overviewPages) {
      if (!addPageWithLimits(page)) break;
    }
  }

  // Rate Limits
  if (rateLimitPages.length > 0 && totalLength < MAX_TOTAL_CONTENT) {
    sections.push('# Rate Limits\n');
    totalLength += 15;
    for (const page of rateLimitPages) {
      if (!addPageWithLimits(page)) break;
    }
  }

  // API Endpoints
  if (endpointPages.length > 0 && totalLength < MAX_TOTAL_CONTENT) {
    sections.push('# API Endpoints\n');
    totalLength += 17;
    for (const page of endpointPages) {
      if (!addPageWithLimits(page)) break;
    }
  }

  // Other
  if (otherPages.length > 0 && totalLength < MAX_TOTAL_CONTENT) {
    sections.push('# Additional Documentation\n');
    totalLength += 28;
    for (const page of otherPages) {
      if (!addPageWithLimits(page)) break;
    }
  }

  // Add summary
  const summary = `\n---\n> Summary: ${pagesIncluded} pages included, ${pagesTruncated} truncated, ${pagesSkipped} skipped due to limits\n> Total content: ${totalLength.toLocaleString()} chars`;
  sections.push(summary);

  console.log(
    `[Parallel Scraper] Aggregated content: ${pagesIncluded}/${successfulPages.length} pages, ${totalLength.toLocaleString()} chars, ${pagesTruncated} truncated, ${pagesSkipped} skipped`
  );

  return sections.join('\n');
}

/**
 * Format a single page section
 */
function formatPageSection(page: ScrapedPage): string {
  const title = page.title || extractTitleFromUrl(page.url);
  const categoryLabel = page.category.replace(/_/g, ' ');

  const lines: string[] = [];
  lines.push(`## ${title} [${categoryLabel}]\n`);
  lines.push(`> Source: ${page.url}\n`);
  lines.push(page.content);
  lines.push('\n---\n');

  return lines.join('\n');
}

/**
 * Extract a readable title from a URL
 */
function extractTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|md)$/i, '')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return parsed.hostname;
  } catch {
    return url;
  }
}
