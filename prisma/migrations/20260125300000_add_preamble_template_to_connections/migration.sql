-- AddPreambleTemplateToConnections
-- Adds preamble_template column for LLM-friendly response context

-- AlterTable
ALTER TABLE "connections" ADD COLUMN "preamble_template" TEXT;

