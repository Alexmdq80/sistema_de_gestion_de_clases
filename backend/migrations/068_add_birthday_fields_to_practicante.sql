-- Migration: Add birthday fields (day/month) to Practicante
-- Used when the exact birth year is unknown

ALTER TABLE Practicante ADD COLUMN cumple_dia INT NULL AFTER fecha_nacimiento;
ALTER TABLE Practicante ADD COLUMN cumple_mes INT NULL AFTER cumple_dia;
