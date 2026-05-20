-- 0005_fix_article_scores_decimal_precision.sql
-- Fix numeric field overflow: decimal(5,3) cannot hold 100.000
-- Need decimal(6,3) for overall_score and weighted_score
-- Also expand ai_relevance, keyword_match, freshness, source_trust to decimal(6,2)
-- Idempotent: checks current column type before altering

DO $$
DECLARE
  col_type text;
BEGIN
  -- ai_relevance: numeric(3,2) → numeric(6,2)
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type FROM information_schema.columns
    WHERE table_name = 'article_scores' AND column_name = 'ai_relevance';
  IF col_type = 'numeric(3,2)' THEN
    ALTER TABLE article_scores ALTER COLUMN ai_relevance TYPE numeric(6,2);
  END IF;

  -- keyword_match: numeric(3,2) → numeric(6,2)
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type FROM information_schema.columns
    WHERE table_name = 'article_scores' AND column_name = 'keyword_match';
  IF col_type = 'numeric(3,2)' THEN
    ALTER TABLE article_scores ALTER COLUMN keyword_match TYPE numeric(6,2);
  END IF;

  -- freshness: numeric(3,2) → numeric(6,2)
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type FROM information_schema.columns
    WHERE table_name = 'article_scores' AND column_name = 'freshness';
  IF col_type = 'numeric(3,2)' THEN
    ALTER TABLE article_scores ALTER COLUMN freshness TYPE numeric(6,2);
  END IF;

  -- source_trust: numeric(3,2) → numeric(6,2)
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type FROM information_schema.columns
    WHERE table_name = 'article_scores' AND column_name = 'source_trust';
  IF col_type = 'numeric(3,2)' THEN
    ALTER TABLE article_scores ALTER COLUMN source_trust TYPE numeric(6,2);
  END IF;

  -- overall_score: numeric(5,3) → numeric(6,3)
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type FROM information_schema.columns
    WHERE table_name = 'article_scores' AND column_name = 'overall_score';
  IF col_type = 'numeric(5,3)' THEN
    ALTER TABLE article_scores ALTER COLUMN overall_score TYPE numeric(6,3);
  END IF;

  -- weighted_score: numeric(5,3) → numeric(6,3)
  SELECT data_type || '(' || numeric_precision || ',' || numeric_scale || ')'
    INTO col_type FROM information_schema.columns
    WHERE table_name = 'article_scores' AND column_name = 'weighted_score';
  IF col_type = 'numeric(5,3)' THEN
    ALTER TABLE article_scores ALTER COLUMN weighted_score TYPE numeric(6,3);
  END IF;
END;
$$;
