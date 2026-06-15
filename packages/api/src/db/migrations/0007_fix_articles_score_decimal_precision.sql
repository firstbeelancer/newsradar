-- 0007_fix_articles_score_decimal_precision.sql
-- Fix numeric field overflow: articles.score numeric(5,3) cannot hold 100.000.
-- The scorer clamps to 0..100, so the storage column must allow 100.000.

DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'articles'
      AND column_name = 'score';

  IF col_type = 'numeric(5,3)' THEN
    ALTER TABLE articles ALTER COLUMN score TYPE numeric(6,3);
  END IF;
END;
$$;
