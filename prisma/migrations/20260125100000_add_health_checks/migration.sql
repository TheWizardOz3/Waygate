-- CreateEnum
CREATE TYPE "HealthCheckStatus" AS ENUM ('healthy', 'degraded', 'unhealthy');

-- CreateEnum
CREATE TYPE "HealthCheckTier" AS ENUM ('credential', 'connectivity', 'full_scan');

-- CreateEnum
CREATE TYPE "HealthCheckTrigger" AS ENUM ('scheduled', 'manual');

-- CreateEnum
CREATE TYPE "CredentialHealthStatus" AS ENUM ('active', 'expiring', 'expired', 'missing');

-- CreateEnum
CREATE TYPE "CircuitBreakerStatus" AS ENUM ('closed', 'open', 'half_open');

-- AlterTable: Add health check config to integrations
ALTER TABLE "integrations" ADD COLUMN "health_check_config" JSONB NOT NULL DEFAULT '{"enabled": true, "credentialCheckMinutes": 15, "connectivityCheckHours": 12, "fullScanEnabled": false}';

-- AlterTable: Add health tracking fields to connections
ALTER TABLE "connections" ADD COLUMN "health_status" "HealthCheckStatus" NOT NULL DEFAULT 'healthy';
ALTER TABLE "connections" ADD COLUMN "last_credential_check_at" TIMESTAMP(3);
ALTER TABLE "connections" ADD COLUMN "last_connectivity_check_at" TIMESTAMP(3);
ALTER TABLE "connections" ADD COLUMN "last_full_scan_at" TIMESTAMP(3);
ALTER TABLE "connections" ADD COLUMN "health_check_test_action_id" UUID;

-- CreateTable
CREATE TABLE "health_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "connection_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "status" "HealthCheckStatus" NOT NULL,
    "check_tier" "HealthCheckTier" NOT NULL,
    "check_trigger" "HealthCheckTrigger" NOT NULL,
    "credential_status" "CredentialHealthStatus",
    "credential_expires_at" TIMESTAMP(3),
    "test_action_id" UUID,
    "test_action_success" BOOLEAN,
    "test_action_latency_ms" INTEGER,
    "test_action_status_code" INTEGER,
    "test_action_error" JSONB,
    "actions_scanned" INTEGER,
    "actions_passed" INTEGER,
    "actions_failed" INTEGER,
    "scan_results" JSONB,
    "circuit_breaker_status" "CircuitBreakerStatus",
    "duration_ms" INTEGER NOT NULL,
    "error" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_checks_connection_created_idx" ON "health_checks"("connection_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "health_checks_tenant_created_idx" ON "health_checks"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "health_checks_tier_idx" ON "health_checks"("check_tier");

-- CreateIndex
CREATE INDEX "health_checks_status_idx" ON "health_checks"("status");

-- CreateIndex
CREATE INDEX "connections_health_status_idx" ON "connections"("health_status");

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_health_check_test_action_id_fkey" FOREIGN KEY ("health_check_test_action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_checks" ADD CONSTRAINT "health_checks_test_action_id_fkey" FOREIGN KEY ("test_action_id") REFERENCES "actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

