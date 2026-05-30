-- Migration 067: Add usado_en_pago_id to MovimientoCaja to track usage in student payments
ALTER TABLE MovimientoCaja
ADD COLUMN usado_en_pago_id INT NULL AFTER usado_en_clase_id;

ALTER TABLE MovimientoCaja
ADD CONSTRAINT fk_movimiento_usado_en_pago FOREIGN KEY (usado_en_pago_id) REFERENCES Pago(id);

CREATE INDEX idx_movimiento_usado_en_pago ON MovimientoCaja(usado_en_pago_id);
