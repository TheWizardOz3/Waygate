-- AlterTable: Add connection_id to field_mappings for per-connection mapping overrides
-- - connectionId = null: Action-level default mapping (applies to all connections)
-- - connectionId set: Connection-specific override (overrides default for that connection)
ALTER TABLE "field_mappings" ADD COLUMN "connection_id" UUID;

-- AlterTable: Add updated_at timestamp to field_mappings
ALTER TABLE "field_mappings" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: Index for efficient connection-based mapping lookups
CREATE INDEX "mappings_action_connection_idx" ON "field_mappings"("action_id", "connection_id");

-- CreateIndex: Unique constraint to prevent duplicate mappings for same (action, connection, sourcePath, direction)
CREATE UNIQUE INDEX "field_mappings_unique_idx" ON "field_mappings"("action_id", "connection_id", "source_path", "direction");

-- AddForeignKey: Link field_mappings to connections
ALTER TABLE "field_mappings" ADD CONSTRAINT "field_mappings_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

