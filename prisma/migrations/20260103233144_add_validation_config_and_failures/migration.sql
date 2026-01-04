-- AlterTable
ALTER TABLE "actions" ADD COLUMN     "validation_config" JSONB;

-- CreateTable
CREATE TABLE "validation_failures" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "issue_code" VARCHAR(50) NOT NULL,
    "field_path" VARCHAR(255) NOT NULL,
    "expected_type" VARCHAR(50),
    "received_type" VARCHAR(50),
    "failure_count" INTEGER NOT NULL DEFAULT 1,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "drift_alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "drift_alert_sent_at" TIMESTAMP(3),

    CONSTRAINT "validation_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "validation_failures_action_idx" ON "validation_failures"("action_id");

-- CreateIndex
CREATE INDEX "validation_failures_tenant_idx" ON "validation_failures"("tenant_id");

-- CreateIndex
CREATE INDEX "validation_failures_last_seen_idx" ON "validation_failures"("last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "validation_failures_action_id_issue_code_field_path_key" ON "validation_failures"("action_id", "issue_code", "field_path");

-- AddForeignKey
ALTER TABLE "validation_failures" ADD CONSTRAINT "validation_failures_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_failures" ADD CONSTRAINT "validation_failures_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
