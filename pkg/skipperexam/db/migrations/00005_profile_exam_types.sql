-- +goose Up
-- A user can prepare for several exam types at once, for example class C and D.
ALTER TABLE profiles ADD COLUMN exam_types text[] NOT NULL DEFAULT '{}';
UPDATE profiles SET exam_types = ARRAY[exam_type];
ALTER TABLE profiles DROP COLUMN exam_type;

-- +goose Down
ALTER TABLE profiles ADD COLUMN exam_type text NOT NULL DEFAULT '';
UPDATE profiles SET exam_type = COALESCE(exam_types[1], '');
ALTER TABLE profiles DROP COLUMN exam_types;
