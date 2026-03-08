-- Migration 054: Add monto_pactado to Abono and enable multiple payments

ALTER TABLE Abono
ADD COLUMN monto_pactado DECIMAL(10, 2) NULL AFTER cantidad;

-- Set initial monto_pactado from existing payments to maintain consistency
UPDATE Abono a 
JOIN (SELECT abono_id, SUM(monto) as total FROM Pago GROUP BY abono_id) p ON a.id = p.abono_id
SET a.monto_pactado = p.total
WHERE a.monto_pactado IS NULL;
