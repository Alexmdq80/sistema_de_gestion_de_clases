-- Migration 051: Add reference amount (standard cost override) to Clase

ALTER TABLE Clase
ADD COLUMN monto_referencia_espacio DECIMAL(10, 2) NULL AFTER monto_pago_espacio;
