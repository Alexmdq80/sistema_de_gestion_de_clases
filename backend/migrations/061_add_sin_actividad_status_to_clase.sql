-- Agregar el estado 'sin_actividad' al enum de la tabla Clase
ALTER TABLE Clase MODIFY COLUMN estado ENUM('programada', 'realizada', 'cancelada', 'suspendida', 'cerrada', 'sin_actividad') DEFAULT 'programada';
