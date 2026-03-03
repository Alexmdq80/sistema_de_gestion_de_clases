-- Migration: Standardize mes_abono format to "Mes Año" (e.g., "Febrero 2026")
-- Description: Converts old "YYYY-MM" format to "Month Year" format for consistency.

UPDATE Pago 
SET mes_abono = CASE 
    WHEN mes_abono LIKE '%-01' THEN CONCAT('Enero ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-02' THEN CONCAT('Febrero ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-03' THEN CONCAT('Marzo ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-04' THEN CONCAT('Abril ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-05' THEN CONCAT('Mayo ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-06' THEN CONCAT('Junio ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-07' THEN CONCAT('Julio ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-08' THEN CONCAT('Agosto ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-09' THEN CONCAT('Septiembre ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-10' THEN CONCAT('Octubre ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-11' THEN CONCAT('Noviembre ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-12' THEN CONCAT('Diciembre ', LEFT(mes_abono, 4))
    ELSE mes_abono 
END
WHERE mes_abono REGEXP '^[0-9]{4}-[0-9]{2}$';

UPDATE Abono 
SET mes_abono = CASE 
    WHEN mes_abono LIKE '%-01' THEN CONCAT('Enero ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-02' THEN CONCAT('Febrero ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-03' THEN CONCAT('Marzo ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-04' THEN CONCAT('Abril ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-05' THEN CONCAT('Mayo ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-06' THEN CONCAT('Junio ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-07' THEN CONCAT('Julio ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-08' THEN CONCAT('Agosto ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-09' THEN CONCAT('Septiembre ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-10' THEN CONCAT('Octubre ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-11' THEN CONCAT('Noviembre ', LEFT(mes_abono, 4))
    WHEN mes_abono LIKE '%-12' THEN CONCAT('Diciembre ', LEFT(mes_abono, 4))
    ELSE mes_abono 
END
WHERE mes_abono REGEXP '^[0-9]{4}-[0-9]{2}$';
