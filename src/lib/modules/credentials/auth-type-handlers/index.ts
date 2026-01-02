// Auth Type Handlers
// Apply authentication to outgoing requests based on credential type

// API Key
export {
  applyApiKeyAuth,
  buildUrlWithApiKey,
  getApiKeyHeaders,
  getApiKeyBodyParams,
  CommonApiKeyHeaders,
  CommonApiKeyParams,
} from './api-key.handler';

export type { AuthenticatedRequestConfig } from './api-key.handler';

// Basic Auth
export { getBasicAuthHeader, getBasicAuthHeaders, applyBasicAuth } from './basic.handler';

// Bearer Token
export {
  getBearerAuthHeader,
  getBearerAuthHeaderFromOAuth2,
  getBearerAuthHeaders,
  getOAuth2AuthHeaders,
  applyBearerAuth,
  applyOAuth2Auth,
} from './bearer.handler';

// Custom Headers
export {
  getCustomHeaders,
  applyCustomHeaders,
  hasRequiredHeaders,
  getHeaderValue,
} from './custom-header.handler';
