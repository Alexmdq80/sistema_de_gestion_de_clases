-- Migration 066: Enhance InscripcionHorario with temporal validity, soft deletes and audit history
-- 1. Ensure columns exist (using IF NOT EXISTS logic via a different approach or just ignore if already there)
-- Since we already have some columns from a partial run, we'll try to add them if they don't exist
-- or just proceed with what's missing.

-- 2. Add individual indexes to satisfy foreign key requirements before dropping the unique compound index
ALTER TABLE InscripcionHorario ADD INDEX idx_practicante (practicante_id);

-- 3. Remove the existing unique key to allow history records
ALTER TABLE InscripcionHorario DROP INDEX idx_alumno_horario;

-- 4. Create HistorialInscripcionHorario table for auditing (using IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS HistorialInscripcionHorario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inscripcion_id INT NOT NULL,
    accion ENUM('CREATE', 'UPDATE', 'DELETE', 'END_VALIDITY') NOT NULL,
    datos_anteriores JSON,
    datos_nuevos JSON,
    usuario_id INT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES User(id) ON DELETE SET NULL
);
