-- Add reingreso_at to Practicante table to track when a student returns from archive
ALTER TABLE Practicante ADD COLUMN reingreso_at DATETIME NULL AFTER archivado_at;
