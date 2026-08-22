/*
# Add validade alert configuration to restaurant_settings

## Overview
Adds four new columns to the existing `restaurant_settings` table so each
restaurant can configure who receives daily expiration alerts, at what time,
and whether push notifications are enabled for the Controle de Validades module.

## 1. Modified Table
- `restaurant_settings`
  - `validade_responsavel_nome` (text, nullable): name of the person responsible for expiration alerts.
  - `validade_responsavel_telefone` (text, nullable): contact phone for the responsible person.
  - `validade_horario_notificacao` (text, nullable, default '08:00'): daily notification time in HH:MM format.
  - `validade_notificacoes_ativas` (boolean, default false): master toggle for push notifications.

## 2. Security
- No new tables. Existing RLS policies on restaurant_settings remain unchanged.
- No changes to policies.
*/

ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS validade_responsavel_nome text,
  ADD COLUMN IF NOT EXISTS validade_responsavel_telefone text,
  ADD COLUMN IF NOT EXISTS validade_horario_notificacao text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS validade_notificacoes_ativas boolean DEFAULT false;
