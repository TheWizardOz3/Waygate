// Auth module - authentication and authorization
// OAuth providers, API key validation

// API Key utilities
export {
  generateApiKey,
  validateApiKey,
  extractApiKey,
  isValidKeyFormat,
  maskApiKey,
} from './api-key';

// OAuth Providers
export {
  OAuthProvider,
  OAuthError,
  generateState,
  generatePkce,
  isStateExpired,
  GenericOAuthProvider,
  createGenericProvider,
} from './oauth-providers';

export type {
  OAuthConfig,
  OAuthState,
  OAuthTokenResponse,
  AuthorizationUrlResult,
  GenericOAuthConfig,
} from './oauth-providers';

// Auth Service
export {
  AuthServiceError,
  // OAuth
  initiateOAuthConnection,
  handleOAuthCallback,
  getOAuthConnectionStatus,
  validateOAuthState,
  // Non-OAuth credential storage
  storeApiKey,
  storeBasicAuth,
  storeBearerToken,
  // Credential management
  disconnectIntegration,
  getIntegrationAuthStatus,
  getIntegrationCredentialHistory,
} from './auth.service';

// Auth Schemas
export {
  // OAuth configuration
  OAuthIntegrationConfigSchema,
  ApiKeyConfigSchema,
  BasicAuthConfigSchema,
  BearerTokenConfigSchema,
  CustomHeaderConfigSchema,
  // API request schemas
  OAuthConnectRequestSchema,
  StoreApiKeyRequestSchema,
  StoreBasicAuthRequestSchema,
  StoreBearerTokenRequestSchema,
  StoreCustomHeaderRequestSchema,
  StoreCredentialRequestSchema,
  // API response schemas
  ApiResponseSchema,
  OAuthConnectResponseSchema,
  OAuthCallbackResultSchema,
  DisconnectResponseSchema,
  CredentialTestResponseSchema,
  IntegrationAuthStatusSchema,
  // Waygate API key schemas
  WaygateApiKeySchema,
  ApiKeyGenerationResultSchema,
  WaygateAuthHeadersSchema,
  // Error codes
  AuthErrorCodes,
} from './auth.schemas';

export type {
  OAuthIntegrationConfig,
  ApiKeyConfig,
  BasicAuthConfig,
  BearerTokenConfig,
  CustomHeaderConfig,
  OAuthConnectRequest,
  StoreApiKeyRequest,
  StoreBasicAuthRequest,
  StoreBearerTokenRequest,
  StoreCustomHeaderRequest,
  StoreCredentialRequest,
  OAuthConnectResponse,
  OAuthCallbackResult,
  DisconnectResponse,
  CredentialTestResponse,
  IntegrationAuthStatus,
  WaygateApiKey,
  ApiKeyGenerationResult,
  WaygateAuthHeaders,
  AuthErrorCode,
} from './auth.schemas';
