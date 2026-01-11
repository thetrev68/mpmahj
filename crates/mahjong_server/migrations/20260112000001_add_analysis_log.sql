-- Add analysis log storage for AI comparison debug data

ALTER TABLE games ADD COLUMN IF NOT EXISTS analysis_log JSONB;
