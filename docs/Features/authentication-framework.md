# Feature: Authentication Framework

**Status:** Complete  
**Priority:** P0  
**Complexity:** HIGH  
**Dependencies:** Database Setup (#2) ✅  
**Blocks:** Token Refresh Management (#7), Gateway API (#8)  
**Started:** 2026-01-02

---

## Overview

### User Story

> As a developer, I want Waygate to handle various authentication methods, so that I can connect to any API regardless of its auth requirements.

### Description

A pluggable authentication system that supports multiple authentication types and manages credentials securely. This feature handles **two distinct authentication concerns**:

1. **Waygate API Key Authentication**: Consuming apps authenticate with Waygate's Gateway API using API keys stored as bcrypt hashes in `Tenant.waygateApiKey`

2. **Integration Credentials**: OAuth tokens, API keys, and other credentials for external services (Slack, Google, etc.) stored encrypted using AES-256-GCM in `IntegrationCredential`

```
┌─────────────────────┐                    ┌─────────────────────┐
│   Consuming App     │                    │   External API      │
│   (Your App)        │                    │   (Slack, Google)   │
└─────────┬───────────┘                    └──────────▲──────────┘
          │                                           │
          │ Waygate API Key                           │ Integration Credential
          │ (bcrypt hash)                             │ (AES-256-GCM encrypted)
          ▼                                           │
┌─────────────────────────────────────────────────────┴──────────┐
│                         WAYGATE                                 │
│   Authenticates consuming app, then uses stored integration     │
│   credentials to call external APIs                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Requirements

### Functional Requirements

- [ ] Support OAuth2 (Authorization Code, Client Credentials, PKCE)
- [ ] Support API Key authentication (header, query param, or body)
- [ ] Support Basic Authentication
- [ ] Support Custom Header authentication
- [ ] Support Bearer Token authentication
- [ ] Securely store credentials (encrypted at rest with AES-256-GCM)
- [ ] Per-tenant credential storage (consuming apps own their credentials)
- [ ] Credential validation on save
- [ ] Support multiple credential sets per integration (e.g., sandbox vs production)
- [ ] Support additional secret configuration (App IDs, signing secrets, environment flags)

### Non-Functional Requirements

- Credentials decrypted only in-memory for requests
- Never log credentials, even in error messages
- API key validation < 50ms overhead
- Encryption key stored in environment variable (never in database)

---

## Acceptance Criteria

- [ ] Given an OAuth2 integration, when user initiates connection, then redirect flow completes and tokens are stored encrypted
- [ ] Given stored credentials, when retrieved for request, then they are decrypted only in memory
- [ ] Given invalid credentials, when tested, then clear error message is returned without leaking sensitive data
- [ ] Given a Waygate API key in Authorization header, when validating, then tenant context is extracted for RLS
- [ ] Given a credential type (OAuth2, API Key, Basic, etc.), when storing, then appropriate validation is performed

---

## Technical Design

### Module Structure

```
src/lib/modules/
├── auth/
│   ├── oauth-providers/
│   │   ├── base.ts              # Base OAuth provider interface
│   │   ├── generic.ts           # Generic OAuth2 provider
│   │   └── index.ts
│   ├── auth.service.ts          # Auth orchestration service
│   ├── auth.schemas.ts          # Zod schemas for auth
│   ├── api-key.ts               # Waygate API key utilities
│   └── index.ts
├── credentials/
│   ├── credential.service.ts    # Credential business logic
│   ├── credential.repository.ts # Database operations
│   ├── credential.schemas.ts    # Zod schemas
│   ├── encryption.ts            # AES-256-GCM encryption
│   ├── auth-type-handlers/      # Per-auth-type handlers
│   │   ├── oauth2.handler.ts
│   │   ├── api-key.handler.ts
│   │   ├── basic.handler.ts
│   │   ├── bearer.handler.ts
│   │   ├── custom-header.handler.ts
│   │   └── index.ts
│   └── index.ts
```

### API Endpoints

| Endpoint                                    | Method | Purpose                             |
| ------------------------------------------- | ------ | ----------------------------------- |
| `/api/v1/integrations/:id/connect`          | POST   | Initiate OAuth flow                 |
| `/api/v1/integrations/:id/disconnect`       | POST   | Revoke credentials                  |
| `/api/v1/integrations/:id/credentials`      | GET    | Get credential status (not secrets) |
| `/api/v1/integrations/:id/credentials/test` | POST   | Test credential validity            |
| `/api/v1/auth/callback/:provider`           | GET    | OAuth callback handler              |

### Database Tables Used

- `tenants.waygate_api_key_hash` - Bcrypt hash of Waygate API key
- `integration_credentials` - Encrypted external API credentials

### Credential Encryption Format

```typescript
// Encrypted data format (AES-256-GCM)
Buffer: [IV (16 bytes)] + [AuthTag (16 bytes)] + [Ciphertext]

// Decrypted credential structure varies by type:
OAuth2Credential {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scopes?: string[];
}

ApiKeyCredential {
  apiKey: string;
  placement: 'header' | 'query' | 'body';
  paramName: string;
}

BasicCredential {
  username: string;
  password: string;
}

BearerCredential {
  token: string;
}

CustomHeaderCredential {
  headers: Record<string, string>;
}
```

---

## Implementation Tasks

### Phase 1: Core Infrastructure (~1.5 hours)

| Task | Description                                                                                                                         | Est. Time | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 1.1  | **Credential Encryption Module**: Implement AES-256-GCM encrypt/decrypt in `encryption.ts`, add ENCRYPTION_KEY to env               | 45 min    | ✅     |
| 1.2  | **Waygate API Key Middleware**: Update `src/lib/api/middleware/auth.ts` to validate API keys, extract tenant context, handle errors | 45 min    | ✅     |

### Phase 2: Credential Management (~1.5 hours)

| Task | Description                                                                                                           | Est. Time | Status |
| ---- | --------------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 2.1  | **Credential Repository**: Implement `credential.repository.ts` with CRUD operations for encrypted credential storage | 45 min    | ✅     |
| 2.2  | **Credential Service**: Implement `credential.service.ts` with encrypt-on-save, decrypt-on-retrieve, validation       | 45 min    | ✅     |

### Phase 3: Auth Type Handlers (~2 hours)

| Task | Description                                                                                                   | Est. Time | Status |
| ---- | ------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 3.1  | **OAuth Provider Base**: Create OAuth2 provider interface with getAuthUrl, exchangeCode, refreshToken methods | 45 min    | ✅     |
| 3.2  | **API Key Handler**: Implement API key credential handler (header/query/body placement)                       | 30 min    | ✅     |
| 3.3  | **Basic & Bearer Handlers**: Implement Basic Auth and Bearer Token handlers                                   | 30 min    | ✅     |
| 3.4  | **Custom Header Handler**: Implement custom header credential handler                                         | 15 min    | ✅     |

### Phase 4: OAuth Flow Endpoints (~3 hours)

| Task | Description                                                                                         | Est. Time | Status |
| ---- | --------------------------------------------------------------------------------------------------- | --------- | ------ |
| 4.1  | **OAuth Connect Endpoint**: POST `/integrations/:id/connect` - generate OAuth URL with state/PKCE   | 60 min    | ✅     |
| 4.2  | **OAuth Callback Handler**: GET `/auth/callback/:provider` - exchange code, store tokens, redirect  | 60 min    | ✅     |
| 4.3  | **Disconnect Endpoint**: POST `/integrations/:id/disconnect` - revoke and mark as revoked           | 30 min    | ✅     |
| 4.4  | **Credential Test Endpoint**: POST `/integrations/:id/credentials/test` - validate credentials work | 30 min    | ✅     |

### Phase 5: Service Integration & Testing (~2.5 hours)

| Task | Description                                                                               | Est. Time | Status |
| ---- | ----------------------------------------------------------------------------------------- | --------- | ------ |
| 5.1  | **Auth Service Integration**: Orchestrate auth flows, integrate with credential service   | 45 min    | ✅     |
| 5.2  | **Zod Schemas**: Create schemas for all auth types and API requests/responses             | 30 min    | ✅     |
| 5.3  | **Unit Tests**: Tests for encryption, credential service, auth middleware, handlers       | 45 min    | ✅     |
| 5.4  | **Integration Tests**: Tests for OAuth flow (mocked), API key validation, credential CRUD | 30 min    | ✅     |

---

## Edge Cases & Error Handling

### Edge Cases

| Scenario                    | Handling                                                       |
| --------------------------- | -------------------------------------------------------------- |
| Multi-step OAuth            | Support additional authorization screens via state tracking    |
| Scope changes               | Detect when stored scopes differ from required, prompt re-auth |
| Rate-limited auth endpoints | Queue auth requests, respect Retry-After headers               |
| Refresh token rotation      | Handle providers that issue new refresh tokens on each use     |
| Concurrent token refresh    | Use database-level locking to prevent race conditions          |

### Error Messages (LLM-Friendly)

```typescript
// Invalid API key
{
  "code": "INVALID_API_KEY",
  "message": "The provided Waygate API key is invalid or has been revoked",
  "suggestedResolution": {
    "action": "REFRESH_CREDENTIALS",
    "description": "Generate a new API key from the Waygate dashboard",
    "retryable": false
  }
}

// OAuth flow failed
{
  "code": "OAUTH_EXCHANGE_FAILED",
  "message": "Failed to exchange authorization code for tokens",
  "suggestedResolution": {
    "action": "RETRY_WITH_MODIFIED_INPUT",
    "description": "The authorization code may have expired. Try initiating the OAuth flow again.",
    "retryable": true
  }
}

// Credential test failed
{
  "code": "CREDENTIAL_VALIDATION_FAILED",
  "message": "The stored credentials failed validation with the external API",
  "suggestedResolution": {
    "action": "CHECK_INTEGRATION_CONFIG",
    "description": "Verify credentials are correct and have not been revoked by the provider",
    "retryable": false
  }
}
```

---

## Security Considerations

1. **Encryption Key Management**
   - Single 32-byte encryption key in `ENCRYPTION_KEY` env var
   - Key rotation requires re-encrypting all credentials (manual process for MVP)

2. **Credential Exposure Prevention**
   - Never log decrypted credentials
   - API responses return credential status, never actual secrets
   - Credentials decrypted only at point of use, never persisted decrypted

3. **API Key Security**
   - Waygate API keys hashed with bcrypt before storage
   - Keys shown only once at creation time
   - Support key rotation without downtime

4. **OAuth State Parameter**
   - CSRF protection via state parameter in OAuth flows
   - State validated on callback

---

## Files to Create/Modify

### New Files

- `src/lib/modules/credentials/encryption.ts`
- `src/lib/modules/credentials/credential.service.ts`
- `src/lib/modules/credentials/credential.repository.ts`
- `src/lib/modules/credentials/credential.schemas.ts`
- `src/lib/modules/credentials/auth-type-handlers/oauth2.handler.ts`
- `src/lib/modules/credentials/auth-type-handlers/api-key.handler.ts`
- `src/lib/modules/credentials/auth-type-handlers/basic.handler.ts`
- `src/lib/modules/credentials/auth-type-handlers/bearer.handler.ts`
- `src/lib/modules/credentials/auth-type-handlers/custom-header.handler.ts`
- `src/lib/modules/credentials/auth-type-handlers/index.ts`
- `src/lib/modules/auth/oauth-providers/base.ts`
- `src/lib/modules/auth/oauth-providers/generic.ts`
- `src/lib/modules/auth/auth.service.ts`
- `src/lib/modules/auth/auth.schemas.ts`
- `src/lib/modules/auth/api-key.ts`
- `src/app/api/v1/integrations/[id]/connect/route.ts`
- `src/app/api/v1/integrations/[id]/disconnect/route.ts`
- `src/app/api/v1/integrations/[id]/credentials/route.ts`
- `src/app/api/v1/integrations/[id]/credentials/test/route.ts`
- `src/app/api/v1/auth/callback/[provider]/route.ts`
- `tests/unit/credentials/encryption.test.ts`
- `tests/unit/credentials/credential.service.test.ts`
- `tests/unit/auth/api-key.test.ts`
- `tests/integration/auth/oauth-flow.test.ts`

### Modify Files

- `src/lib/api/middleware/auth.ts` - Add Waygate API key validation
- `src/lib/modules/credentials/index.ts` - Export new modules
- `src/lib/modules/auth/index.ts` - Export new modules
- `.env.example` - Add ENCRYPTION_KEY

---

## Definition of Done

- [ ] All implementation tasks completed
- [ ] Unit tests passing with 80%+ coverage on auth modules
- [ ] Integration tests passing for OAuth flow and API key validation
- [ ] No credentials logged anywhere (verified by log audit)
- [ ] ENCRYPTION_KEY documented in `.env.example`
- [ ] API endpoints documented in architecture.md
- [ ] changelog.md updated
- [ ] project_status.md updated

---

## Notes

- Token Refresh Management (#7) will build on this framework to implement automatic OAuth token refresh
- Gateway API (#8) will use the Waygate API Key middleware implemented here
- For MVP, we implement a generic OAuth2 provider; specific providers (Slack, Google) can be added as needed

---

**Estimated Total Time:** ~10.5 hours  
**Last Updated:** 2026-01-02
