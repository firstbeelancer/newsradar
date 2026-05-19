-- 0003_fix_article_scores_decimal_precision.sql
-- Fix numeric field overflow: decimal(5,3) cannot hold 100.000
-- Need decimal(6,3) for overall_score and weighted_score
-- Also expand ai_relevance, keyword_match, freshness, source_trust to decimal(5,1) → decimal(6,2)

ALTER TABLE article_scores
  ALTER COLUMN ai_relevance TYPE decimal(6,2),
  ALTER COLUMN keyword_match TYPE decimal(6,2),
  ALTER COLUMN freshness TYPE decimal(6,2),
  ALTER COLUMN source_trust TYPE decimal(6,2),
  ALTER COLUMN overall_score TYPE decimal(6,3),
  ALTER COLUMN weighted_score TYPE decimal(6,3);
