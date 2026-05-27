-- Migration 065: Create InscripcionHorario table to link students with specific schedules
CREATE TABLE IF NOT EXISTS InscripcionHorario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    practicante_id INT NOT NULL,
    horario_id INT NOT NULL,
    fecha_inscripcion DATE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (practicante_id) REFERENCES Practicante(id) ON DELETE CASCADE,
    FOREIGN KEY (horario_id) REFERENCES Horario(id) ON DELETE CASCADE,
    UNIQUE KEY idx_alumno_horario (practicante_id, horario_id)
);
