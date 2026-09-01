-- Normalize legacy order_items.customizations JSON:
-- 1. Remove combo groups with empty items arrays
-- 2. Remap orphan top-level extras into the last combo group's last item
-- 3. Trim empty groupNames (set to empty string consistently)

DO $$
BEGIN
  UPDATE order_items
  SET customizations = (
    SELECT jsonb_build_object(
      'combos', COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'groupName', COALESCE(NULLIF(TRIM(c.value->>'groupName'), ''), ''),
              'items', c.value->'items'
            )
          )
          FROM jsonb_array_elements(customizations->'combos') AS c
          WHERE jsonb_array_length(c.value->'items') > 0
        ),
        '[]'::jsonb
      ),
      'extras', '[]'::jsonb,
      'meio_a_meio', COALESCE(customizations->'meio_a_meio', 'null'::jsonb),
      'observations', COALESCE(customizations->'observations', 'null'::jsonb)
    )
  )
  WHERE customizations ? 'combos'
    AND (
      customizations::text LIKE '%"groupName": ""%'
      OR customizations::text LIKE '%"items": []%'
      OR (customizations->'extras' IS NOT NULL AND jsonb_array_length(customizations->'extras') > 0)
    );
END
$$;