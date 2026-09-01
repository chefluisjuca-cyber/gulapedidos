-- Backfill sort_order for legacy combo_groups, combo_group_items, and combo_item_extras
-- so that reordering works for ALL items, old and new.

-- combo_groups: assign sequential sort_order by id within each product
WITH ranked_groups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY id) - 1 AS new_sort
  FROM combo_groups
  WHERE sort_order IS NULL OR sort_order = 0
)
UPDATE combo_groups cg
SET sort_order = rg.new_sort
FROM ranked_groups rg
WHERE cg.id = rg.id;

-- combo_group_items: assign sequential sort_order by id within each combo_group
WITH ranked_items AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY combo_group_id ORDER BY id) - 1 AS new_sort
  FROM combo_group_items
  WHERE sort_order IS NULL OR sort_order = 0
)
UPDATE combo_group_items cgi
SET sort_order = ri.new_sort
FROM ranked_items ri
WHERE cgi.id = ri.id;

-- combo_item_extras: assign sequential sort_order by id within each combo_group_item
WITH ranked_extras AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY combo_group_item_id ORDER BY id) - 1 AS new_sort
  FROM combo_item_extras
  WHERE sort_order IS NULL OR sort_order = 0
)
UPDATE combo_item_extras cie
SET sort_order = re.new_sort
FROM ranked_extras re
WHERE cie.id = re.id;