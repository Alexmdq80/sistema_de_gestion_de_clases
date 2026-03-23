-- Migration 058: Add clase_id to MovimientoCaja for credit note traceability

ALTER TABLE MovimientoCaja 
ADD COLUMN clase_id INT NULL AFTER lugar_id;

-- Index for traceability
CREATE INDEX idx_movimiento_clase ON MovimientoCaja(clase_id);

-- Add foreign key constraint
ALTER TABLE MovimientoCaja
ADD FOREIGN KEY (clase_id) REFERENCES Clase(id) ON DELETE SET NULL;
