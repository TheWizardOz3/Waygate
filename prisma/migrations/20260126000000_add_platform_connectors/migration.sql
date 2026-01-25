-- Migration: Add Platform Connectors and Related Fields
-- This migration adds the platform connectors feature that was in the schema but missing from the database

-- =============================================================================
-- Step 1: Create ConnectorType enum
-- =============================================================================
CREATE TYPE "ConnectorType" AS ENUM ('platform', 'custom');

-- =============================================================================
-- Step 2: Create PlatformConnectorStatus enum
-- =============================================================================
CREATE TYPE "PlatformConnectorStatus" AS ENUM ('active', 'deprecated', 'disabled');

-- =============================================================================
-- Step 3: Create platform_connectors table
-- =============================================================================
CREATE TABLE "platform_connectors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider_slug" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "auth_type" "AuthType" NOT NULL,
    "encrypted_client_id" BYTEA NOT NULL,
    "encrypted_client_secret" BYTEA NOT NULL,
    "authorization_url" TEXT NOT NULL,
    "token_url" TEXT NOT NULL,
    "default_scopes" TEXT[] NOT NULL DEFAULT '{}',
    "callback_path" VARCHAR(255) NOT NULL,
    "certifications" JSONB NOT NULL DEFAULT '{}',
    "rate_limits" JSONB NOT NULL DEFAULT '{}',
    "status" "PlatformConnectorStatus" NOT NULL DEFAULT 'active',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_connectors_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- Step 4: Add unique constraint on provider_slug
-- =============================================================================
CREATE UNIQUE INDEX "platform_connectors_provider_slug_key" ON "platform_connectors"("provider_slug");

-- =============================================================================
-- Step 5: Add status index
-- =============================================================================
CREATE INDEX "platform_connectors_status_idx" ON "platform_connectors"("status");

-- =============================================================================
-- Step 6: Add connector_type and platform_connector_id to connections
-- =============================================================================
ALTER TABLE "connections" ADD COLUMN "connector_type" "ConnectorType" NOT NULL DEFAULT 'custom';
ALTER TABLE "connections" ADD COLUMN "platform_connector_id" UUID;

-- =============================================================================
-- Step 7: Add index for platform_connector_id lookup
-- =============================================================================
CREATE INDEX "connections_platform_connector_id_idx" ON "connections"("platform_connector_id");

-- =============================================================================
-- Step 8: Add foreign key constraint
-- =============================================================================
ALTER TABLE "connections" ADD CONSTRAINT "connections_platform_connector_id_fkey" 
    FOREIGN KEY ("platform_connector_id") REFERENCES "platform_connectors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

