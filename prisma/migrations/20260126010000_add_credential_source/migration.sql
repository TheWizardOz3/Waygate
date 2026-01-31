-- =============================================================================
-- Migration: Add credential_source column to integration_credentials
-- This was missing from the schema - the column exists in Prisma but not in DB
-- =============================================================================

-- Step 1: Create the CredentialSource enum
CREATE TYPE "CredentialSource" AS ENUM ('platform', 'user_owned');

-- Step 2: Add the credential_source column with default value
ALTER TABLE "integration_credentials" 
ADD COLUMN "credential_source" "CredentialSource" NOT NULL DEFAULT 'user_owned';

-- Step 3: Create index for credential_source lookup
CREATE INDEX "credentials_source_idx" ON "integration_credentials"("credential_source");

