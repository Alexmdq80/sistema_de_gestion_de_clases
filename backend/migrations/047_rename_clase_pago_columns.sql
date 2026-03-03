-- Migration: Rename professor payment columns to space payment
-- Description: Renames columns in Clase table to better reflect their meaning (Space Cost).

-- Use RENAME COLUMN if using MySQL 8.0+, or CHANGE COLUMN for earlier versions
-- Standard way compatible with many versions
ALTER TABLE Clase CHANGE COLUMN pago_profesor_realizado pago_espacio_realizado BOOLEAN DEFAULT FALSE;
ALTER TABLE Clase CHANGE COLUMN fecha_pago_profesor fecha_pago_espacio DATE NULL;

-- Manage indexes (DROP INDEX syntax varies, but usually simple)
-- Note: MySQL 5.7 and below don't support DROP INDEX IF EXISTS
ALTER TABLE Clase DROP INDEX idx_pago_profesor;
CREATE INDEX idx_pago_espacio ON Clase(pago_espacio_realizado);
