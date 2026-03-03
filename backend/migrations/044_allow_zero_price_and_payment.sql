-- 044_allow_zero_price_and_payment.sql
-- Description: Allows price in TipoAbono and monto in Pago to be zero.

-- 1. Update TipoAbono constraints
-- 'duracion_dias > 0' was tipoabono_chk_1 (dropped in 006)
-- 'precio > 0' is typically tipoabono_chk_2
ALTER TABLE TipoAbono DROP CHECK tipoabono_chk_2;
ALTER TABLE TipoAbono ADD CONSTRAINT tipoabono_precio_min CHECK (precio >= 0);

-- 2. Update Pago constraints
-- 'monto > 0' is typically pago_chk_1
ALTER TABLE Pago DROP CHECK pago_chk_1;
ALTER TABLE Pago ADD CONSTRAINT pago_monto_min CHECK (monto >= 0);
