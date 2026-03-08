-- Migration 049: Add DNI to Practicante table

ALTER TABLE Practicante
ADD COLUMN dni VARCHAR(20) NULL AFTER nombre_completo;
