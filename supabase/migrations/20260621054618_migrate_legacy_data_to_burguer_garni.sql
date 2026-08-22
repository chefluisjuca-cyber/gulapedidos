-- Associate all legacy (restaurant_id = NULL) data with Burguer Garni
-- restaurant id: c5440ad4-98ef-4b62-a320-1f0104c399c0

DO $$
DECLARE
  rid uuid := 'c5440ad4-98ef-4b62-a320-1f0104c399c0';
BEGIN
  UPDATE restaurant_settings SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE categories          SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE products            SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE loyalty_configs     SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE loyalty_rewards     SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE loyalty_customers   SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE orders              SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE order_items         SET restaurant_id = rid WHERE restaurant_id IS NULL;
  UPDATE waiter_calls        SET restaurant_id = rid WHERE restaurant_id IS NULL;
END $$;
