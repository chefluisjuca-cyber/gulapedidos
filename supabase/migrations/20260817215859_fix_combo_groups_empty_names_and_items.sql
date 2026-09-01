-- Fix combo groups that have empty names with real items, and named groups with empty items.
-- Pattern: "Escolha seus Burgers" group has empty-name items, unnamed group has real burger items.
-- Solution: move real items to the named group, delete the unnamed empty group.

-- For each product, find the named-but-empty group and the unnamed-but-filled group,
-- then move items from the unnamed group to the named group, and delete the unnamed group.

-- 1) "2 Buguers  + 2 Fritas + Bebidas"
-- Named group: d6695355-92d3-4bdc-a669-763e49ee83d4 ("Escolha seus Burgers", sort 1, empty items)
-- Unnamed group: 572fc17f-9d81-4cb2-a2c0-1f85aa61c60c ("", sort 2, real items)
UPDATE combo_group_items SET combo_group_id = 'd6695355-92d3-4bdc-a669-763e49ee83d4'
WHERE combo_group_id = '572fc17f-9d81-4cb2-a2c0-1f85aa61c60c';
DELETE FROM combo_groups WHERE id = '572fc17f-9d81-4cb2-a2c0-1f85aa61c60c';
-- Delete the empty-name items that were in the named group
DELETE FROM combo_group_items WHERE combo_group_id = 'd6695355-92d3-4bdc-a669-763e49ee83d4' AND name = '';

-- 2) "3 Buguers  + 3 Fritas + 3 Bebidas "
-- Named group: fc86af7f-1d3c-4457-aa9f-0c68a24f679b ("Escolha seus Burgers", sort 1, empty items)
-- Unnamed group: 42fdd4d8-034a-4b79-a3ce-10d5c31237d1 ("", sort 2, real items)
UPDATE combo_group_items SET combo_group_id = 'fc86af7f-1d3c-4457-aa9f-0c68a24f679b'
WHERE combo_group_id = '42fdd4d8-034a-4b79-a3ce-10d5c31237d1';
DELETE FROM combo_groups WHERE id = '42fdd4d8-034a-4b79-a3ce-10d5c31237d1';
DELETE FROM combo_group_items WHERE combo_group_id = 'fc86af7f-1d3c-4457-aa9f-0c68a24f679b' AND name = '';

-- 3) "Combo Buguer  + Fritas"
-- Named group: 35ac22d0-6e51-49a8-9a72-cd56b87f1097 ("Escolha seu Burguer", sort 0, empty items)
-- Unnamed group: 84a5a622-454e-4142-8d30-5e5ceb750587 ("", sort 1, real items)
UPDATE combo_group_items SET combo_group_id = '35ac22d0-6e51-49a8-9a72-cd56b87f1097'
WHERE combo_group_id = '84a5a622-454e-4142-8d30-5e5ceb750587';
DELETE FROM combo_groups WHERE id = '84a5a622-454e-4142-8d30-5e5ceb750587';
DELETE FROM combo_group_items WHERE combo_group_id = '35ac22d0-6e51-49a8-9a72-cd56b87f1097' AND name = '';

-- 4) "Combo Buguer  + Fritas + Bebida"
-- Named group: c22ad260-b4d2-44b8-a65a-088e8b471ded ("Escolha seu Burguer", sort 1, empty items)
-- Unnamed group: e6baca04-5053-4e1a-9d3e-7a817320ea80 ("", sort 2, real items)
UPDATE combo_group_items SET combo_group_id = 'c22ad260-b4d2-44b8-a65a-088e8b471ded'
WHERE combo_group_id = 'e6baca04-5053-4e1a-9d3e-7a817320ea80';
DELETE FROM combo_groups WHERE id = 'e6baca04-5053-4e1a-9d3e-7a817320ea80';
DELETE FROM combo_group_items WHERE combo_group_id = 'c22ad260-b4d2-44b8-a65a-088e8b471ded' AND name = '';
