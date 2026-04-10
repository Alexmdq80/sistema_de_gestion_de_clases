-- Add 'activo' column to Practicante table
ALTER TABLE Practicante ADD COLUMN activo BOOLEAN DEFAULT TRUE;

-- Update history record for existing practicantes to reflect their initial state
-- (Optional, but good for consistency if we wanted to log the state change in history)
