-- ============================================================
-- Migration 004: Rename session/session_number to class_number
-- Purpose: Clarify that the curriculum progression (1-36) is
--          called "class_number", not "session_number".
--          The sessions table still represents temporal events.
--
-- Final Nomenclature:
--   - Batch: cohort of students (values 1+)
--   - Class Number: progression within a level (values 1-36)
--   - Session: temporal instance when batch meets (this table)
--   - Level: academic increment (values 1-5)
-- ============================================================

-- 1. Rename session_number to class_number in sessions table
ALTER TABLE sessions RENAME COLUMN session_number TO class_number;

-- 2. Rename session to class_number in activities table
ALTER TABLE activities RENAME COLUMN session TO class_number;

-- 3. Rename sequence_in_session to sequence_in_class in activities table
ALTER TABLE activities RENAME COLUMN sequence_in_session TO sequence_in_class;

-- 4. Add comments to clarify usage
COMMENT ON COLUMN sessions.class_number IS 'Which class (1-36) within the level was covered in this session';
COMMENT ON COLUMN activities.class_number IS 'Which class (1-36) within the level uses this activity';
COMMENT ON COLUMN activities.sequence_in_class IS 'Position of this activity within the class (for fixed OCR column positions)';

-- 5. Update the existing check constraint on activities.class_number
-- (The constraint was previously on 'session', now on 'class_number')
-- Note: The constraint should already exist with the new column name after rename
-- We're just documenting the expected constraint:
-- CHECK (class_number IS NULL OR (class_number >= 1 AND class_number <= 36))
