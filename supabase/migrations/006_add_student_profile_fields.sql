-- ============================================================
-- Migration: Add learning_summary field for personalized learning
-- Purpose: Add learning_summary to support AI-generated progress tracking
--          Note: gender, learning_style, and medical_notes already exist
-- ============================================================

-- Add learning_summary column (rolling summary of last 5 classes)
ALTER TABLE students
ADD COLUMN IF NOT EXISTS learning_summary TEXT;

COMMENT ON COLUMN students.learning_summary IS 'AI-generated summary of student learning progress from last 5 classes. Updated automatically after each class report generation.';

-- Add check constraint for learning_style values (if not already exists)
-- This ensures only valid learning styles are stored
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_learning_style_values'
  ) THEN
    ALTER TABLE students
    ADD CONSTRAINT chk_learning_style_values
    CHECK (
      learning_style IS NULL OR
      (
        learning_style <@ ARRAY['looker', 'listener', 'mover']::TEXT[] AND
        array_length(learning_style, 1) > 0
      )
    );
  END IF;
END $$;

-- Create index on learning_style for efficient queries (if not already exists)
CREATE INDEX IF NOT EXISTS idx_students_learning_style ON students USING GIN (learning_style);
