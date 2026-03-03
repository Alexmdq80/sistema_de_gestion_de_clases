import { ValidationError } from './errors.js';

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date string to validate
 * @returns {boolean}
 */
export function isValidDate(date) {
  if (!date) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;
  
  const parsedDate = new Date(date);
  return parsedDate instanceof Date && !isNaN(parsedDate);
}

/**
 * Validate phone number (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (!phone) return false;
  // Basic validation: allows numbers, spaces, +, -, ()
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 8;
}

/**
 * Validate positive number
 * @param {number} value - Number to validate
 * @returns {boolean}
 */
export function isPositiveNumber(value) {
  return typeof value === 'number' && value > 0;
}

/**
 * Validate required field
 * @param {any} value - Value to check
 * @param {string} fieldName - Name of the field
 * @throws {ValidationError}
 */
export function validateRequired(value, fieldName) {
  if (value === null || value === undefined || value === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
}

/**
 * Validate practicante data
 * @param {Object} data - Practicante data
 * @throws {ValidationError}
 */
export function validatePracticante(data) {
  const errors = [];

  // Validate nombre_completo
  if (!data.nombre_completo || typeof data.nombre_completo !== 'string' || data.nombre_completo.trim() === '') {
    errors.push({
      field: 'nombre_completo',
      message: 'nombre_completo is required'
    });
  }

  // Validate at least one of telefono or email
  if (!data.telefono && !data.email) {
    errors.push({
      field: 'telefono',
      message: 'At least one of telefono or email must be provided'
    });
  }

  // Validate email format if provided
  if (data.email && !isValidEmail(data.email)) {
    errors.push({
      field: 'email',
      message: 'email must be a valid email address'
    });
  }

  // Validate phone format if provided
  if (data.telefono && !isValidPhone(data.telefono)) {
    errors.push({
      field: 'telefono',
      message: 'telefono must be a valid phone number'
    });
  }

  // Validate fecha_nacimiento if provided
  if (data.fecha_nacimiento && !isValidDate(data.fecha_nacimiento)) {
    errors.push({
      field: 'fecha_nacimiento',
      message: 'fecha_nacimiento must be a valid date in YYYY-MM-DD format'
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }
}

/**
 * Validate user data for registration
 * @param {Object} data - User data
 * @throws {ValidationError}
 */
export function validateUser(data) {
    const errors = [];

    // Validate email
    if (!data.email || typeof data.email !== 'string' || data.email.trim() === '') {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!isValidEmail(data.email)) {
        errors.push({ field: 'email', message: 'Email must be a valid email address' });
    }

    // Validate password
    if (!data.password || typeof data.password !== 'string' || data.password.trim() === '') {
        errors.push({ field: 'password', message: 'Password is required' });
    } else if (data.password.length < 8) {
        errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    }
    // Add more password complexity rules if desired, e.g.,
    // else if (!/[A-Z]/.test(data.password)) { errors.push({ field: 'password', message: 'Password must contain at least one uppercase letter' }); }
    // else if (!/[a-z]/.test(data.password)) { errors.push({ field: 'password', message: 'Password must contain at least one lowercase letter' }); }
    // else if (!/[0-9]/.test(data.password)) { errors.push({ field: 'password', message: 'Password must contain at least one number' }); }
    // else if (!/[^A-Za-z0-9]/.test(data.password)) { errors.push({ field: 'password', message: 'Password must contain at least one special character' }); }


    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
    }
}

/**
 * Validate TipoAbono data
 * @param {Object} data - TipoAbono data
 * @throws {ValidationError}
 */
export function validateTipoAbono(data) {
    const errors = [];

    // Validate nombre
    if (!data.nombre || typeof data.nombre !== 'string' || data.nombre.trim() === '') {
        errors.push({ field: 'nombre', message: 'Nombre is required' });
    }

    // Validate duracion_dias
    if (data.duracion_dias !== undefined && data.duracion_dias !== null && data.duracion_dias !== '') {
        const duracion = parseInt(data.duracion_dias, 10);
        if (isNaN(duracion) || duracion < 0) {
            errors.push({ field: 'duracion_dias', message: 'Duración en días must be a non-negative integer' });
        }
    }

    // Validate precio
    if (data.precio !== undefined && data.precio !== null && data.precio !== '') {
        const price = parseFloat(data.precio);
        if (isNaN(price) || price < 0) {
            errors.push({ field: 'precio', message: 'Precio must be a non-negative number' });
        }
    }

    // Validate clases_por_semana
    if (data.clases_por_semana !== undefined && data.clases_por_semana !== null && data.clases_por_semana !== '') {
        const count = parseInt(data.clases_por_semana, 10);
        if (isNaN(count) || count <= 0) {
            errors.push({ field: 'clases_por_semana', message: 'Clases por semana must be a positive integer' });
        }
    }

    // Validate max_personas
    if (data.max_personas !== undefined && data.max_personas !== null && data.max_personas !== '') {
        const max = parseInt(data.max_personas, 10);
        if (isNaN(max) || max <= 0) {
            errors.push({ field: 'max_personas', message: 'Capacidad de personas must be a positive integer' });
        }
    }

    // Validate horarios
    if (data.horarios !== undefined && data.horarios !== null) {
        if (!Array.isArray(data.horarios)) {
            errors.push({ field: 'horarios', message: 'Horarios must be an array' });
        }
    }

    if (errors.length > 0) {
        throw new ValidationError('Validation failed', errors);
    }
}

/**
 * Sanitize string input to prevent XSS
 * @param {string} input - Input string
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return input;
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize object values (recursive)
 * @param {Object} obj - Object to sanitize
 * @returns {Object} - Sanitized object
 */
export function sanitizeObject(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  return sanitized;
}
