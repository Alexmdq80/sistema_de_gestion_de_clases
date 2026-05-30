import { 
    isValidEmail, 
    isValidDate, 
    isValidPhone, 
    validateTipoAbono 
} from './validators.js';

describe('Validators Unit Tests', () => {
    
    describe('isValidEmail', () => {
        test('should return true for valid emails', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        });

        test('should return false for invalid emails', () => {
            expect(isValidEmail('invalid-email')).toBe(false);
            expect(isValidEmail('test@')).toBe(false);
            expect(isValidEmail('@example.com')).toBe(false);
            expect(isValidEmail(null)).toBe(false);
        });
    });

    describe('isValidDate', () => {
        test('should return true for valid YYYY-MM-DD dates', () => {
            expect(isValidDate('2024-05-30')).toBe(true);
            expect(isValidDate('2000-01-01')).toBe(true);
        });

        test('should return false for invalid formats or dates', () => {
            expect(isValidDate('30-05-2024')).toBe(false);
            expect(isValidDate('2024/05/30')).toBe(false);
            expect(isValidDate('not-a-date')).toBe(false);
            expect(isValidDate(null)).toBe(false);
        });
    });

    describe('validateTipoAbono', () => {
        test('should not throw for valid TipoAbono data', () => {
            const validData = {
                nombre: 'Abono Mensual',
                duracion_dias: 30,
                precio: 5000.50
            };
            expect(() => validateTipoAbono(validData)).not.toThrow();
        });

        test('should throw ValidationError for missing nombre', () => {
            const invalidData = {
                duracion_dias: 30,
                precio: 5000
            };
            expect(() => validateTipoAbono(invalidData)).toThrow();
        });

        test('should throw ValidationError for negative precio', () => {
            const invalidData = {
                nombre: 'Abono Error',
                precio: -100
            };
            expect(() => validateTipoAbono(invalidData)).toThrow();
        });
    });
});
