-- Migration 059: Add usado_en_clase_id to MovimientoCaja to track usage without deleting
ALTER TABLE MovimientoCaja 
ADD COLUMN usado_en_clase_id INT NULL AFTER clase_id;

-- Index for performance
CREATE INDEX idx_movimiento_usado_en ON MovimientoCaja(usado_en_clase_id);

-- Foreign key constraint
ALTER TABLE MovimientoCaja
ADD FOREIGN KEY (usado_en_clase_id) REFERENCES Clase(id) ON DELETE SET NULL;
