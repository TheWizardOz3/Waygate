# Changelog Archive: Pre-V1.0 Releases

> **Archived:** 2026-01-26
> **Covers:** v0.0.0 through v0.9.0 (2026-01-01 to 2026-01-25)
> **Current changelog:** See `docs/changelog.md` for v1.0.0+

---

## Version Summary

| Version | Date       | Summary                                             |
| ------- | ---------- | --------------------------------------------------- |
| 0.9.0   | 2026-01-25 | Per-App Custom Mappings complete (V0.75 Feature #4) |
| 0.8.1   | 2026-01-25 | Continuous Integration Testing complete             |
| 0.8.0   | 2026-01-25 | Hybrid Auth Model complete (V0.75 Feature #2)       |
| 0.7.0   | 2026-01-25 | Multi-App Connections complete (V0.75 Feature #1)   |
| 0.6.2   | 2026-01-05 | Linear-style UI polish, live dashboard data         |
| 0.6.1   | 2026-01-04 | AI Scraper reliability fixes                        |
| 0.6.0   | 2026-01-04 | V0.5 complete, roadmap restructure                  |
| 0.5.5   | 2026-01-04 | Dashboard Polish & Tagging finalized                |
| 0.5.4   | 2026-01-04 | Integration & Action Tagging System                 |
| 0.5.3   | 2026-01-03 | Basic Field Mapping complete                        |
| 0.5.2   | 2026-01-03 | Response Validation complete                        |
| 0.5.1   | 2026-01-03 | Pagination Handler complete                         |
| 0.1.x   | 2026-01-02 | Various bug fixes and enhancements                  |
| 0.1.0   | 2026-01-02 | **MVP Complete** - Basic Configuration UI           |
| 0.0.8   | 2026-01-02 | Gateway API complete                                |
| 0.0.7   | 2026-01-02 | Token Refresh Management complete                   |
| 0.0.6   | 2026-01-02 | Action Registry & Schema complete                   |
| 0.2.0   | 2026-01-02 | AI Documentation Scraper complete                   |
| 0.0.1   | 2026-01-02 | Core infrastructure (Auth + DB + Execution)         |
| 0.0.0   | 2026-01-01 | Initial documentation and project setup             |

---

## Milestone Summaries

### MVP (v0.0.0 - v0.1.0)

Core platform established: Next.js 14 + TypeScript + Tailwind + Prisma + Supabase. Features: AI documentation scraping (Firecrawl + Gemini), action registry with JSON Schema validation, multi-type authentication (OAuth2, API Key, Bearer, Basic), execution engine with retry/circuit breaker, Gateway API, and configuration dashboard.

### V0.5 (v0.5.1 - v0.5.5)

Production robustness features: Auto-pagination (cursor/offset/page/link strategies), response validation (strict/warn/lenient modes with drift detection), JSONPath field mapping with type coercion, and tagging system for organization.

### V0.75 (v0.7.0 - v0.9.0)

Multi-tenancy and flexibility: Connection entity for per-app credential isolation, hybrid auth model with platform connectors, three-tier health check system (credential/connectivity/full scan), and per-connection field mapping overrides with LLM response preamble.

---

## Key Technical Milestones

- **2026-01-01**: Project scaffolding, Prisma 7 pg adapter configuration
- **2026-01-02**: MVP complete with 592 tests passing
- **2026-01-03**: Intelligent crawling, template auto-detection, LLM-friendly pagination
- **2026-01-04**: Gemini 3 optimization, simplified extraction prompts
- **2026-01-25**: V0.75 complete - multi-app connections, hybrid auth, health checks, custom mappings

---

_For detailed implementation notes from this period, see git history or feature docs in `docs/Features/`._
