-- Migration 050: Add custom payment amount to Clase for space rental

ALTER TABLE Clase
ADD COLUMN monto_pago_espacio DECIMAL(10, 2) NULL AFTER fecha_pago_espacio;
