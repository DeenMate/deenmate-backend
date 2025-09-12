-- Load overrides already present in staging.hadith_book_title_overrides
-- Apply to public.hadith_books by joining collection name and book number
WITH coll AS (
  SELECT id, name FROM public.hadith_collections
)
UPDATE public.hadith_books b
SET title_en = COALESCE(NULLIF(o.title_en, ''), b.title_en),
    title_ar = COALESCE(NULLIF(o.title_ar, ''), b.title_ar)
FROM staging.hadith_book_title_overrides o
JOIN coll c ON lower(c.name) = lower(o.collection)
WHERE b.collection_id = c.id AND b.number = o.number;

-- Show a small sample per collection
SELECT c.name, b.number, b.title_en, b.title_ar
FROM public.hadith_books b
JOIN public.hadith_collections c ON c.id = b.collection_id
ORDER BY c.name, b.number
LIMIT 20;
