import { describe, it, expect } from 'vitest';
import {
  applyApiKeyAuth,
  buildUrlWithApiKey,
  getApiKeyHeaders,
  getApiKeyBodyParams,
} from '@/lib/modules/credentials/auth-type-handlers/api-key.handler';
import {
  getBasicAuthHeader,
  getBasicAuthHeaders,
  applyBasicAuth,
} from '@/lib/modules/credentials/auth-type-handlers/basic.handler';
import {
  getBearerAuthHeader,
  getBearerAuthHeaders,
  getBearerAuthHeaderFromOAuth2,
  getOAuth2AuthHeaders,
  applyBearerAuth,
  applyOAuth2Auth,
} from '@/lib/modules/credentials/auth-type-handlers/bearer.handler';
import {
  getCustomHeaders,
  applyCustomHeaders,
  hasRequiredHeaders,
} from '@/lib/modules/credentials/auth-type-handlers/custom-header.handler';
import type {
  ApiKeyCredentialData,
  BasicCredentialData,
  BearerCredentialData,
  OAuth2CredentialData,
  CustomHeaderCredentialData,
} from '@/lib/modules/credentials/credential.schemas';

describe('Auth Type Handlers', () => {
  describe('API Key Handler', () => {
    describe('applyApiKeyAuth', () => {
      it('should add API key to headers config when placement is header', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'header',
          paramName: 'X-API-Key',
        };

        const config = applyApiKeyAuth(credential);

        expect(config.headers['X-API-Key']).toBe('sk-1234567890');
        expect(config.queryParams).toEqual({});
        expect(config.bodyParams).toEqual({});
      });

      it('should add API key to queryParams when placement is query', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'query',
          paramName: 'api_key',
        };

        const config = applyApiKeyAuth(credential);

        expect(config.queryParams['api_key']).toBe('sk-1234567890');
        expect(config.headers).toEqual({});
        expect(config.bodyParams).toEqual({});
      });

      it('should add API key to bodyParams when placement is body', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'body',
          paramName: 'apiKey',
        };

        const config = applyApiKeyAuth(credential);

        expect(config.bodyParams['apiKey']).toBe('sk-1234567890');
        expect(config.headers).toEqual({});
        expect(config.queryParams).toEqual({});
      });
    });

    describe('buildUrlWithApiKey', () => {
      it('should append API key to URL when placement is query', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'query',
          paramName: 'api_key',
        };

        const url = buildUrlWithApiKey('https://api.example.com/data', credential);

        expect(url).toBe('https://api.example.com/data?api_key=sk-1234567890');
      });

      it('should append to existing query string', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'query',
          paramName: 'api_key',
        };

        const url = buildUrlWithApiKey('https://api.example.com/data?foo=bar', credential);

        expect(url).toContain('api_key=sk-1234567890');
        expect(url).toContain('foo=bar');
      });

      it('should return unchanged URL when placement is not query', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'header',
          paramName: 'X-API-Key',
        };

        const url = buildUrlWithApiKey('https://api.example.com/data', credential);

        expect(url).toBe('https://api.example.com/data');
      });
    });

    describe('getApiKeyHeaders', () => {
      it('should return headers object when placement is header', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'header',
          paramName: 'X-API-Key',
        };

        const headers = getApiKeyHeaders(credential);

        expect(headers).toEqual({ 'X-API-Key': 'sk-1234567890' });
      });

      it('should return empty object when placement is not header', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'query',
          paramName: 'api_key',
        };

        const headers = getApiKeyHeaders(credential);

        expect(headers).toEqual({});
      });
    });

    describe('getApiKeyBodyParams', () => {
      it('should return body params when placement is body', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'body',
          paramName: 'apiKey',
        };

        const params = getApiKeyBodyParams(credential);

        expect(params).toEqual({ apiKey: 'sk-1234567890' });
      });

      it('should return empty object when placement is not body', () => {
        const credential: ApiKeyCredentialData = {
          apiKey: 'sk-1234567890',
          placement: 'header',
          paramName: 'X-API-Key',
        };

        const params = getApiKeyBodyParams(credential);

        expect(params).toEqual({});
      });
    });
  });

  describe('Basic Auth Handler', () => {
    describe('getBasicAuthHeader', () => {
      it('should create valid Base64 encoded Basic auth header', () => {
        const credential: BasicCredentialData = {
          username: 'user@example.com',
          password: 'secret123',
        };

        const header = getBasicAuthHeader(credential);

        // Base64 of "user@example.com:secret123"
        const expected = Buffer.from('user@example.com:secret123').toString('base64');
        expect(header).toBe(`Basic ${expected}`);
      });

      it('should handle special characters in credentials', () => {
        const credential: BasicCredentialData = {
          username: 'user:name',
          password: 'pass:word@123',
        };

        const header = getBasicAuthHeader(credential);

        const expected = Buffer.from('user:name:pass:word@123').toString('base64');
        expect(header).toBe(`Basic ${expected}`);
      });
    });

    describe('getBasicAuthHeaders', () => {
      it('should return headers object with Authorization', () => {
        const credential: BasicCredentialData = {
          username: 'user',
          password: 'pass',
        };

        const headers = getBasicAuthHeaders(credential);

        expect(headers.Authorization).toMatch(/^Basic /);
      });
    });

    describe('applyBasicAuth', () => {
      it('should merge Authorization header into existing headers', () => {
        const credential: BasicCredentialData = {
          username: 'user',
          password: 'pass',
        };
        const existingHeaders = { 'Content-Type': 'application/json' };

        const result = applyBasicAuth(existingHeaders, credential);

        expect(result.Authorization).toMatch(/^Basic /);
        expect(result['Content-Type']).toBe('application/json');
      });
    });
  });

  describe('Bearer Token Handler', () => {
    describe('getBearerAuthHeader', () => {
      it('should create Bearer token header', () => {
        const credential: BearerCredentialData = {
          token: 'my-bearer-token',
        };

        const header = getBearerAuthHeader(credential);

        expect(header).toBe('Bearer my-bearer-token');
      });
    });

    describe('getBearerAuthHeaders', () => {
      it('should return headers object with Authorization', () => {
        const credential: BearerCredentialData = {
          token: 'my-bearer-token',
        };

        const headers = getBearerAuthHeaders(credential);

        expect(headers.Authorization).toBe('Bearer my-bearer-token');
      });
    });

    describe('applyBearerAuth', () => {
      it('should merge Authorization header into existing headers', () => {
        const credential: BearerCredentialData = {
          token: 'my-bearer-token',
        };
        const existingHeaders = { 'Content-Type': 'application/json' };

        const result = applyBearerAuth(existingHeaders, credential);

        expect(result.Authorization).toBe('Bearer my-bearer-token');
        expect(result['Content-Type']).toBe('application/json');
      });
    });

    describe('getBearerAuthHeaderFromOAuth2', () => {
      it('should use Bearer as default token type', () => {
        const credential: OAuth2CredentialData = {
          accessToken: 'oauth-access-token',
          tokenType: 'Bearer',
        };

        const header = getBearerAuthHeaderFromOAuth2(credential);

        expect(header).toBe('Bearer oauth-access-token');
      });

      it('should use specified token type', () => {
        const credential: OAuth2CredentialData = {
          accessToken: 'oauth-access-token',
          tokenType: 'MAC',
        };

        const header = getBearerAuthHeaderFromOAuth2(credential);

        expect(header).toBe('MAC oauth-access-token');
      });
    });

    describe('getOAuth2AuthHeaders', () => {
      it('should return headers with OAuth2 Authorization', () => {
        const credential: OAuth2CredentialData = {
          accessToken: 'oauth-access-token',
          tokenType: 'Bearer',
        };

        const headers = getOAuth2AuthHeaders(credential);

        expect(headers.Authorization).toBe('Bearer oauth-access-token');
      });
    });

    describe('applyOAuth2Auth', () => {
      it('should merge OAuth2 Authorization header', () => {
        const credential: OAuth2CredentialData = {
          accessToken: 'oauth-access-token',
          tokenType: 'Bearer',
        };
        const existingHeaders = { 'Content-Type': 'application/json' };

        const result = applyOAuth2Auth(existingHeaders, credential);

        expect(result.Authorization).toBe('Bearer oauth-access-token');
        expect(result['Content-Type']).toBe('application/json');
      });
    });
  });

  describe('Custom Header Handler', () => {
    describe('getCustomHeaders', () => {
      it('should return copy of custom headers', () => {
        const credential: CustomHeaderCredentialData = {
          headers: { 'X-Custom-Auth': 'secret-value' },
        };

        const headers = getCustomHeaders(credential);

        expect(headers['X-Custom-Auth']).toBe('secret-value');
      });

      it('should return multiple headers', () => {
        const credential: CustomHeaderCredentialData = {
          headers: {
            'X-Api-Key': 'api-key-123',
            'X-App-Id': 'app-id-456',
            'X-Signature': 'sig-789',
          },
        };

        const headers = getCustomHeaders(credential);

        expect(headers['X-Api-Key']).toBe('api-key-123');
        expect(headers['X-App-Id']).toBe('app-id-456');
        expect(headers['X-Signature']).toBe('sig-789');
      });
    });

    describe('applyCustomHeaders', () => {
      it('should merge custom headers into existing headers', () => {
        const credential: CustomHeaderCredentialData = {
          headers: { 'X-Custom-Auth': 'secret-value' },
        };
        const existingHeaders = { 'Content-Type': 'application/json' };

        const result = applyCustomHeaders(existingHeaders, credential);

        expect(result['X-Custom-Auth']).toBe('secret-value');
        expect(result['Content-Type']).toBe('application/json');
      });

      it('should override existing headers with same name', () => {
        const credential: CustomHeaderCredentialData = {
          headers: { 'X-Custom': 'new-value' },
        };
        const existingHeaders = { 'X-Custom': 'old-value' };

        const result = applyCustomHeaders(existingHeaders, credential);

        expect(result['X-Custom']).toBe('new-value');
      });
    });

    describe('hasRequiredHeaders', () => {
      it('should return true when all required headers present', () => {
        const credential: CustomHeaderCredentialData = {
          headers: {
            'X-Api-Key': 'key',
            'X-App-Id': 'id',
          },
        };

        const result = hasRequiredHeaders(credential, ['X-Api-Key', 'X-App-Id']);

        expect(result).toBe(true);
      });

      it('should return false when required header missing', () => {
        const credential: CustomHeaderCredentialData = {
          headers: { 'X-Api-Key': 'key' },
        };

        const result = hasRequiredHeaders(credential, ['X-Api-Key', 'X-App-Id']);

        expect(result).toBe(false);
      });

      it('should return false when header value is empty', () => {
        const credential: CustomHeaderCredentialData = {
          headers: { 'X-Api-Key': '' },
        };

        const result = hasRequiredHeaders(credential, ['X-Api-Key']);

        expect(result).toBe(false);
      });
    });
  });
});
