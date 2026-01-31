-- Add AI Tool Export configuration fields to actions table
-- These fields store LLM-generated descriptions and response templates for AI tool consumption

-- Tool description: LLM-optimized mini-prompt format description
ALTER TABLE "actions" ADD COLUMN "tool_description" TEXT;

-- Success template: Template for formatting successful tool responses
ALTER TABLE "actions" ADD COLUMN "tool_success_template" TEXT;

-- Error template: Template for formatting error responses
ALTER TABLE "actions" ADD COLUMN "tool_error_template" TEXT;
