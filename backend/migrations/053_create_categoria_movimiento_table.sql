-- Migration 053: Create CategoriaMovimiento table

CREATE TABLE IF NOT EXISTS CategoriaMovimiento (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    tipo_sugerido ENUM('ingreso', 'egreso', 'ambos') DEFAULT 'ambos',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial categories
INSERT INTO CategoriaMovimiento (nombre, tipo_sugerido) VALUES 
('Venta Merchandising', 'ingreso'),
('Insumos / Librería', 'egreso'),
('Devolución a Practicante', 'egreso'),
('Ajuste de Pago', 'ambos'),
('Limpieza / Mantenimiento', 'egreso'),
('Sueldos / Profesores', 'egreso'),
('Servicios (Luz, Gas, etc.)', 'egreso'),
('Otros', 'ambos');
