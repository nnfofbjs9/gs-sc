-- ============================================================
-- Migration: Add center_student_id to students table
-- Purpose: Provide a short, center-scoped, human-readable
--          identifier for worksheets and OCR matching.
-- ============================================================

-- 1. Add the column
ALTER TABLE students
ADD COLUMN IF NOT EXISTS center_student_id VARCHAR(4);

-- 2. Populate existing students with sequential IDs per center
-- Uses a CTE to assign row numbers per center, then updates
WITH numbered AS (
  SELECT
    s.student_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.center_id
      ORDER BY s.student_name
    ) AS rn
  FROM students s
  JOIN classes c ON s.class_id = c.class_id
)
UPDATE students
SET center_student_id = LPAD(numbered.rn::TEXT, 4, '0')
FROM numbered
WHERE students.student_id = numbered.student_id;

-- 3. Create a function to auto-generate center_student_id on INSERT
CREATE OR REPLACE FUNCTION generate_center_student_id()
RETURNS TRIGGER AS $$
DECLARE
  v_center_id UUID;
  v_max_id INT;
  v_new_id INT;
BEGIN
  -- Only generate if not explicitly provided
  IF NEW.center_student_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the center_id from the student's class
  SELECT center_id INTO v_center_id
  FROM classes
  WHERE class_id = NEW.class_id;

  IF v_center_id IS NULL THEN
    RAISE EXCEPTION 'Class % does not exist or has no center', NEW.class_id;
  END IF;

  -- Find the max existing numeric center_student_id for this center
  SELECT COALESCE(MAX(s.center_student_id::INT), 0) INTO v_max_id
  FROM students s
  JOIN classes c ON s.class_id = c.class_id
  WHERE c.center_id = v_center_id
    AND s.center_student_id ~ '^\d+$';

  v_new_id := v_max_id + 1;

  IF v_new_id > 9999 THEN
    RAISE EXCEPTION 'Center student ID overflow: center % has reached 9999 students', v_center_id;
  END IF;

  NEW.center_student_id := LPAD(v_new_id::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create the trigger (drop first if re-running)
DROP TRIGGER IF EXISTS trg_generate_center_student_id ON students;

CREATE TRIGGER trg_generate_center_student_id
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION generate_center_student_id();

-- 5. Add a unique constraint per center (using a function-based approach)
-- Since center_id lives on classes, we create a unique index via a helper function
-- NOTE: Must use schema-qualified public.classes so PostgreSQL can resolve
-- the table reference when inlining the function for the index expression.
CREATE OR REPLACE FUNCTION get_center_id_for_student(p_class_id UUID)
RETURNS UUID AS $$
  SELECT center_id FROM public.classes WHERE class_id = p_class_id;
$$ LANGUAGE sql STABLE;

-- Unique index: no two students in the same center can share a center_student_id
DROP INDEX IF EXISTS idx_unique_center_student_id;

CREATE UNIQUE INDEX idx_unique_center_student_id
  ON students (get_center_id_for_student(class_id), center_student_id)
  WHERE center_student_id IS NOT NULL;
