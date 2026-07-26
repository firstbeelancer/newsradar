-- Allow 'web' source type for HTML news page scraping.
ALTER TABLE "sources" DROP CONSTRAINT IF EXISTS "sources_type_check";
ALTER TABLE "sources" ADD CONSTRAINT "sources_type_check" CHECK ("type" IN ('rss', 'telegram', 'web'));
