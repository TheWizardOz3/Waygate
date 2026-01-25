/**
 * Platform Connectors Module
 *
 * Manages platform connectors - Waygate's registered OAuth apps with major providers.
 * Enables "one-click connect" experiences for users.
 *
 * Key capabilities:
 * - Encrypted storage of OAuth client credentials
 * - Certification tracking (CASA, publisher verification)
 * - Rate limit configuration
 * - Status management (active, suspended, deprecated)
 */

// =============================================================================
// Schemas & Types
// =============================================================================

export {
  // Enums
  PlatformConnectorStatusSchema,
  AuthTypeSchema,
  // Certification schemas
  CasaCertificationSchema,
  AppReviewCertificationSchema,
  CertificationsSchema,
  // Rate limit schemas
  RateLimitsSchema,
  // CRUD schemas
  CreatePlatformConnectorInputSchema,
  UpdatePlatformConnectorInputSchema,
  // Query schemas
  PlatformConnectorFiltersSchema,
  ListPlatformConnectorsQuerySchema,
  // Response schemas
  PlatformConnectorResponseSchema,
  ListPlatformConnectorsResponseSchema,
  // Helper functions
  toPlatformConnectorResponse,
  // Error codes
  PlatformConnectorErrorCodes,
} from './platform-connector.schemas';

export type {
  PlatformConnectorStatus,
  AuthType,
  Certifications,
  RateLimits,
  CreatePlatformConnectorInput,
  UpdatePlatformConnectorInput,
  PlatformConnectorFilters,
  ListPlatformConnectorsQuery,
  PlatformConnectorResponse,
  ListPlatformConnectorsResponse,
  PlatformConnectorWithSecrets,
} from './platform-connector.schemas';

// =============================================================================
// Repository (Data Access)
// =============================================================================

export {
  createPlatformConnector as createPlatformConnectorDb,
  findPlatformConnectorById,
  findPlatformConnectorBySlug,
  findActivePlatformConnectorBySlug,
  findAllPlatformConnectors,
  findAllActivePlatformConnectors,
  isProviderSlugTaken,
  countPlatformConnectorsByStatus,
  getPlatformConnectorUsageCount,
  updatePlatformConnector as updatePlatformConnectorDb,
  updatePlatformConnectorStatus,
  updatePlatformConnectorCertifications,
  deletePlatformConnector as deletePlatformConnectorDb,
  deprecatePlatformConnector as deprecatePlatformConnectorDb,
  suspendPlatformConnector as suspendPlatformConnectorDb,
} from './platform-connector.repository';

export type {
  CreatePlatformConnectorDbInput,
  UpdatePlatformConnectorDbInput,
} from './platform-connector.repository';

// =============================================================================
// Service (Business Logic)
// =============================================================================

export {
  // Error class
  PlatformConnectorError,
  // Create
  createPlatformConnector,
  // Read (no secrets)
  getPlatformConnectorById,
  getPlatformConnectorByIdOrThrow,
  getPlatformConnectorBySlug,
  getPlatformConnectorBySlugOrThrow,
  getActivePlatformConnectorBySlug,
  listPlatformConnectors,
  listActivePlatformConnectors,
  // Read (with secrets - internal only!)
  getPlatformConnectorWithSecrets,
  getPlatformConnectorWithSecretsById,
  // Update
  updatePlatformConnector,
  activatePlatformConnector,
  suspendPlatformConnector,
  deprecatePlatformConnector,
  // Validation
  validatePlatformConnectorAvailable,
  isPlatformConnectorAvailable,
  getPlatformConnectorUsage,
} from './platform-connector.service';
