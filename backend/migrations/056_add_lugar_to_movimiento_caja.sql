ALTER TABLE MovimientoCaja ADD COLUMN lugar_id INT NULL AFTER fecha;
ALTER TABLE MovimientoCaja ADD CONSTRAINT fk_movimiento_lugar FOREIGN KEY (lugar_id) REFERENCES Lugar(id);
