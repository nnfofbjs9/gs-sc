-- ============================================================
-- Migration 002: Rename "class" to "batch"
-- Purpose: Eliminate confusion around the word "class" by
--          renaming it to "batch" (a group of students).
-- ============================================================

-- 1. Drop dependent objects that reference the old table/column names
DROP INDEX IF EXISTS idx_unique_center_student_id;
DROP FUNCTION IF EXISTS get_center_id_for_student(UUID);
DROP TRIGGER IF EXISTS trg_generate_center_student_id ON students;
DROP FUNCTION IF EXISTS generate_center_student_id();

-- 2. Rename the classes table to batches and rename its columns
-- First check if the table exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'classes') THEN
    RAISE EXCEPTION 'Table "classes" does not exist. This migration requires an existing "classes" table.';
  END IF;
END $$;

ALTER TABLE classes RENAME TO batches;
ALTER TABLE batches RENAME COLUMN class_id TO batch_id;
ALTER TABLE batches RENAME COLUMN class_name TO batch_name;
ALTER TABLE batches RENAME COLUMN class_code TO batch_code;

-- 3. Rename FK columns in dependent tables
ALTER TABLE students RENAME COLUMN class_id TO batch_id;
ALTER TABLE sessions RENAME COLUMN class_id TO batch_id;

-- 4. Rename the class_activities junction table
ALTER TABLE class_activities RENAME TO batch_activities;
ALTER TABLE batch_activities RENAME COLUMN class_id TO batch_id;

-- 5. Recreate helper function with new names
-- Drop again to ensure clean state
DROP FUNCTION IF EXISTS get_center_id_for_student(UUID);

CREATE FUNCTION get_center_id_for_student(p_batch_id UUID)
RETURNS UUID AS $$
  SELECT center_id FROM public.batches WHERE batch_id = p_batch_id;
$$ LANGUAGE sql IMMUTABLE;

-- 6. Recreate trigger function with new references
CREATE OR REPLACE FUNCTION generate_center_student_id()
RETURNS TRIGGER AS $$
DECLARE
  v_center_id UUID;
  v_max_id INT;
  v_new_id INT;
BEGIN
  IF NEW.center_student_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT center_id INTO v_center_id
  FROM batches
  WHERE batch_id = NEW.batch_id;

  IF v_center_id IS NULL THEN
    RAISE EXCEPTION 'Batch % does not exist or has no center', NEW.batch_id;
  END IF;

  SELECT COALESCE(MAX(s.center_student_id::INT), 0) INTO v_max_id
  FROM students s
  JOIN batches b ON s.batch_id = b.batch_id
  WHERE b.center_id = v_center_id
    AND s.center_student_id ~ '^\d+$';

  v_new_id := v_max_id + 1;

  IF v_new_id > 9999 THEN
    RAISE EXCEPTION 'Center student ID overflow: center % has reached 9999 students', v_center_id;
  END IF;

  NEW.center_student_id := LPAD(v_new_id::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Recreate trigger
CREATE TRIGGER trg_generate_center_student_id
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION generate_center_student_id();

-- 8. Recreate unique index
CREATE UNIQUE INDEX idx_unique_center_student_id
  ON students (get_center_id_for_student(batch_id), center_student_id)
  WHERE center_student_id IS NOT NULL;
