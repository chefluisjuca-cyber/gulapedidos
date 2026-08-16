/*
# Add ifood_merchant_id to delivery_settings

Adds a new column to delivery_settings so the ifood-webhook Edge Function
can resolve which restaurant a given iFood event belongs to.

1. Modified Tables
   - `delivery_settings`: new column `ifood_merchant_id` (text, nullable)
     This is the merchant UUID visible in the iFood Partner Portal under
     Minha Conta → Dados do Estabelecimento → ID do Estabelecimento.
     It is stored alongside the client_id/secret to complete the mapping
     between an inbound webhook event and a restaurant row.
*/

ALTER TABLE delivery_settings
  ADD COLUMN IF NOT EXISTS ifood_merchant_id text;
