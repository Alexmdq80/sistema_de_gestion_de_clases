-- Migration 052: Create MovimientoCaja table for general cash flow management

CREATE TABLE IF NOT EXISTS MovimientoCaja (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('ingreso', 'egreso') NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    categoria VARCHAR(100) NOT NULL, -- Ej: 'Venta', 'Insumos', 'Devolución', 'Limpieza', etc.
    descripcion TEXT NULL,
    fecha DATE NOT NULL,
    practicante_id INT NULL,
    usuario_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (practicante_id) REFERENCES Practicante(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES User(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Index for performance in reports
CREATE INDEX idx_movimiento_fecha ON MovimientoCaja(fecha);
CREATE INDEX idx_movimiento_tipo ON MovimientoCaja(tipo);
