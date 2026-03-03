-- 045_allow_null_numero_socio.sql
-- Description: Makes numero_socio nullable in Socio table.

ALTER TABLE Socio MODIFY COLUMN numero_socio VARCHAR(50) NULL;
