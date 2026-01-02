-- CreateEnum
CREATE TYPE "AuthType" AS ENUM ('oauth2', 'api_key', 'basic', 'bearer', 'custom_header');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('draft', 'active', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('oauth2_tokens', 'api_key', 'basic', 'bearer');

-- CreateEnum
CREATE TYPE "CredentialStatus" AS ENUM ('active', 'expired', 'revoked', 'needs_reauth');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateEnum
CREATE TYPE "MappingDirection" AS ENUM ('input', 'output');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "waygate_api_key_hash" VARCHAR(255) NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "documentation_url" TEXT,
    "auth_type" "AuthType" NOT NULL,
    "auth_config" JSONB NOT NULL DEFAULT '{}',
    "status" "IntegrationStatus" NOT NULL DEFAULT 'draft',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "integration_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "http_method" "HttpMethod" NOT NULL,
    "endpoint_template" TEXT NOT NULL,
    "input_schema" JSONB NOT NULL DEFAULT '{}',
    "output_schema" JSONB NOT NULL DEFAULT '{}',
    "pagination_config" JSONB,
    "retry_config" JSONB,
    "cacheable" BOOLEAN NOT NULL DEFAULT false,
    "cache_ttl_seconds" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "integration_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "credential_type" "CredentialType" NOT NULL,
    "encrypted_data" BYTEA NOT NULL,
    "expires_at" TIMESTAMP(3),
    "encrypted_refresh_token" BYTEA,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "CredentialStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action_id" UUID NOT NULL,
    "tenant_id" UUID,
    "source_path" VARCHAR(255) NOT NULL,
    "target_path" VARCHAR(255) NOT NULL,
    "transform_config" JSONB,
    "direction" "MappingDirection" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "integration_id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "request_summary" JSONB NOT NULL,
    "response_summary" JSONB,
    "status_code" INTEGER,
    "latency_ms" INTEGER NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_waygate_api_key_hash_key" ON "tenants"("waygate_api_key_hash");

-- CreateIndex
CREATE INDEX "integrations_tenant_id_idx" ON "integrations"("tenant_id");

-- CreateIndex
CREATE INDEX "integrations_status_idx" ON "integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_tenant_id_slug_key" ON "integrations"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "actions_integration_id_idx" ON "actions"("integration_id");

-- CreateIndex
CREATE UNIQUE INDEX "actions_integration_id_slug_key" ON "actions"("integration_id", "slug");

-- CreateIndex
CREATE INDEX "credentials_integration_id_idx" ON "integration_credentials"("integration_id");

-- CreateIndex
CREATE INDEX "credentials_tenant_id_idx" ON "integration_credentials"("tenant_id");

-- CreateIndex
CREATE INDEX "credentials_expires_at_idx" ON "integration_credentials"("expires_at");

-- CreateIndex
CREATE INDEX "mappings_action_tenant_idx" ON "field_mappings"("action_id", "tenant_id");

-- CreateIndex
CREATE INDEX "logs_tenant_created_idx" ON "request_logs"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "logs_integration_created_idx" ON "request_logs"("integration_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "logs_action_created_idx" ON "request_logs"("action_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
