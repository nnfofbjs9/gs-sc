-- ============================================================
-- Migration 003: Reverse "class" back to "session"
-- Purpose: Restore the original "session" nomenclature for
--          temporal units (when a batch meets at a center).
--          This reverses the previous incorrect rename.
--
-- Nomenclature:
--   - Batch: cohort of students (values 1+)
--   - Class: progression within a level (values 1-36)
--   - Session: temporal unit when batch meets (random IDs) ✓ THIS TABLE
--   - Level: academic increment (values 1-5)
-- ============================================================

-- 1. Rename the classes table back to sessions
ALTER TABLE classes RENAME TO sessions;

-- 2. Rename PK column
ALTER TABLE sessions RENAME COLUMN class_id TO session_id;

-- 3. Rename data columns
ALTER TABLE sessions RENAME COLUMN class_date TO session_date;
ALTER TABLE sessions RENAME COLUMN class_number TO session_number;

-- 4. Rename FK columns in dependent tables
ALTER TABLE reports RENAME COLUMN class_id TO session_id;
ALTER TABLE activity_logs RENAME COLUMN class_id TO session_id;

-- 5. Rename the activities column back to session (it represents class number within level)
-- Note: This column actually represents "class number" (1-36 within a level)
-- but we're keeping it as "session" in the activities table for now to maintain
-- consistency with the previous schema. In the future, this should be renamed to
-- "class_number" to match the nomenclature properly.
ALTER TABLE activities RENAME COLUMN class_number TO session;
