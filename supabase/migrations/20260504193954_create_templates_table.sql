/*
  # Create templates table for bingo card styling

  1. New Tables
    - `templates`
      - `id` (uuid, primary key)
      - `name` (text, template name)
      - `config` (jsonb, styling configuration)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `templates` table
    - Add policies for authenticated users to manage templates
*/

CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all templates"
  ON templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create templates"
  ON templates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete templates"
  ON templates FOR DELETE
  TO authenticated
  USING (true);
