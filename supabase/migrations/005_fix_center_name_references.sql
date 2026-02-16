-- ============================================================
-- Migration 005: Fix center_id references to use center_name
-- Purpose: Update database functions to use center_name instead
--          of center_id since centers table uses center_name as PK
-- ============================================================

-- 1. Drop the unique index first (it depends on the old function)
DROP INDEX IF EXISTS idx_unique_center_student_id;

-- 2. Drop the old function
DROP FUNCTION IF EXISTS get_center_id_for_student(UUID);

-- 3. Create new function using center_name
CREATE FUNCTION get_center_name_for_student(p_batch_id UUID)
RETURNS TEXT AS $$
  SELECT center_name FROM public.batches WHERE batch_id = p_batch_id;
$$ LANGUAGE sql IMMUTABLE;

-- 4. Recreate the generate_center_student_id trigger function
--    to use center_name instead of center_id
CREATE OR REPLACE FUNCTION generate_center_student_id()
RETURNS TRIGGER AS $$
DECLARE
  v_center_name TEXT;
  v_max_id INT;
  v_new_id INT;
BEGIN
  IF NEW.center_student_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the center_name from the student's batch
  SELECT center_name INTO v_center_name
  FROM batches
  WHERE batch_id = NEW.batch_id;

  IF v_center_name IS NULL THEN
    RAISE EXCEPTION 'Batch % does not exist or has no center', NEW.batch_id;
  END IF;

  -- Find the max center_student_id for this center
  SELECT COALESCE(MAX(s.center_student_id::INT), 0) INTO v_max_id
  FROM students s
  JOIN batches b ON s.batch_id = b.batch_id
  WHERE b.center_name = v_center_name
    AND s.center_student_id ~ '^\d+$';

  v_new_id := v_max_id + 1;

  IF v_new_id > 9999 THEN
    RAISE EXCEPTION 'Center student ID overflow: center % has reached 9999 students', v_center_name;
  END IF;

  NEW.center_student_id := LPAD(v_new_id::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Recreate the unique index using the new function name
CREATE UNIQUE INDEX idx_unique_center_student_id
  ON students (get_center_name_for_student(batch_id), center_student_id)
  WHERE center_student_id IS NOT NULL;
