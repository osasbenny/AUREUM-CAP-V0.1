DO $$
DECLARE
  required_tables text[] := ARRAY['organizations','people','contacts','campaigns','prospects','products','product_fit','website_audits','offers','messages','responses','opportunities','deals','purchases','suppression_list','events'];
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    RAISE EXCEPTION 'pgcrypto extension is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
    RAISE EXCEPTION 'citext extension is missing';
  END IF;
  FOREACH table_name IN ARRAY required_tables LOOP
    IF to_regclass(table_name) IS NULL THEN
      RAISE EXCEPTION 'required table is missing: %', table_name;
    END IF;
  END LOOP;
END $$;

SELECT 'schema_ok' AS verification,
       (SELECT count(*) FROM products) AS product_count,
       (SELECT count(*) FROM campaigns) AS campaign_count;
