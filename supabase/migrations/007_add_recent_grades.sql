-- Add recent_class_grades column to students table for GPT-based personalized homework
-- This stores the last 3 classes of grades aggregated by learning area

ALTER TABLE students
ADD COLUMN recent_class_grades JSONB DEFAULT '[]';

-- Add comment explaining the data structure
COMMENT ON COLUMN students.recent_class_grades IS 'Last 3 classes of grades in simple format for GPT analysis: [{class_number, session_date, grades: {learning_area: grade}}]';

-- Example data structure:
-- [
--   {
--     "class_number": 34,
--     "session_date": "2026-02-15",
--     "grades": {
--       "Motor": "A",
--       "Language": "C",
--       "Social": "B",
--       "Academic": "C"
--     }
--   },
--   {
--     "class_number": 35,
--     "session_date": "2026-02-18",
--     "grades": {
--       "Motor": "B",
--       "Language": "C",
--       "Social": "A",
--       "Academic": "C"
--     }
--   },
--   {
--     "class_number": 36,
--     "session_date": "2026-02-21",
--     "grades": {
--       "Motor": "A",
--       "Language": "B",
--       "Social": "B",
--       "Academic": "B"
--     }
--   }
-- ]
