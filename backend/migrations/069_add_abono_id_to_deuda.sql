-- 069_add_abono_id_to_deuda.sql
-- Description: Adds abono_id to Deuda table to link debts with their originating abono.

ALTER TABLE Deuda ADD COLUMN abono_id INT NULL AFTER clase_id;
ALTER TABLE Deuda ADD CONSTRAINT fk_deuda_abono FOREIGN KEY (abono_id) REFERENCES Abono(id) ON DELETE SET NULL;
