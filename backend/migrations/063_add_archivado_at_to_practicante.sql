-- Add 'archivado_at' column to track when a practicante is archived
ALTER TABLE Practicante ADD COLUMN archivado_at TIMESTAMP NULL;

-- Initialize archivado_at for existing archived practicantes
-- Use updated_at as a best-effort fallback for existing archived records
UPDATE Practicante SET archivado_at = updated_at WHERE activo = 0 AND archivado_at IS NULL;
