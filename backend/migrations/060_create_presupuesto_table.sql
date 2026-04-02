-- Migration: Create Presupuesto tables
CREATE TABLE IF NOT EXISTS Presupuesto (
    id INT AUTO_INCREMENT PRIMARY KEY,
    practicante_id INT NULL,
    cliente_nombre VARCHAR(255) NOT NULL,
    fecha DATE NOT NULL,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    observaciones TEXT NULL,
    usuario_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (practicante_id) REFERENCES Practicante(id) ON DELETE SET NULL,
    FOREIGN KEY (usuario_id) REFERENCES User(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS PresupuestoItem (
    id INT AUTO_INCREMENT PRIMARY KEY,
    presupuesto_id INT NOT NULL,
    descripcion TEXT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    abono_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (presupuesto_id) REFERENCES Presupuesto(id) ON DELETE CASCADE,
    FOREIGN KEY (abono_id) REFERENCES TipoAbono(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
