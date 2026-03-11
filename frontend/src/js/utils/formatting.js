/**
 * Formatting utilities for dates, currency, etc.
 */

/**
 * Format date to YYYY-MM-DD
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
export function formatDate(date) {
  if (!date) return '';
  
  // If it's already a YYYY-MM-DD string, return it as is to avoid timezone shifts
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Format date to readable format (DD/MM/YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
export function formatDateReadable(date) {
  if (!date) return '';
  
  // Handle YYYY-MM-DD strings specifically to avoid UTC shift
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${day}/${month}/${year}`;
}

/**
 * Format date to readable format with dashes (DD-MM-YYYY)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date
 */
export function formatDateDashes(date) {
  if (!date) return '';

  // Handle YYYY-MM-DD strings specifically to avoid UTC shift
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `${day}-${month}-${year}`;
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${day}-${month}-${year}`;
}

/**
 * Format date to readable format with day name (e.g., Lunes 08/03/2026)
 * @param {Date|string} date - Date to format
 * @returns {string} - Formatted date with day name
 */
export function formatDateWithDay(date) {
  if (!date) return '';
  
  let d;
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-').map(Number);
    d = new Date(year, month - 1, day);
  } else {
    d = date instanceof Date ? date : new Date(date);
  }

  if (isNaN(d.getTime())) return '';

  const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayName = dayNames[d.getDay()];
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${dayName} ${day}/${month}/${year}`;
}

/**
 * Format currency
 * @param {number|string} amount - Amount to format
 * @param {string} currency - Currency code (default: 'USD')
 * @returns {string} - Formatted currency
 */
export function formatCurrency(amount, currency = 'USD') {
  if (amount === null || amount === undefined || amount === '') return '';
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '';

  // Use Intl.NumberFormat for proper localization
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: currency === 'USD' ? 'EUR' : currency, // Default to EUR for European formatting
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Format phone number (basic formatting)
 * @param {string} phone - Phone number
 * @returns {string} - Formatted phone number
 */
export function formatPhone(phone) {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Basic formatting for common lengths
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }
  if (digits.length === 9) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  }
  
  return phone;
}

/**
 * Format time to HH:MM
 * @param {Date|string} time - Time to format
 * @returns {string} - Formatted time
 */
export function formatTime(time) {
  if (!time) return '';
  
  const t = time instanceof Date ? time : new Date(`2000-01-01T${time}`);
  if (isNaN(t.getTime())) return time;

  const hours = String(t.getHours()).padStart(2, '0');
  const minutes = String(t.getMinutes()).padStart(2, '0');
  
  return `${hours}:${minutes}`;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @param {string} suffix - Suffix to add (default: '...')
 * @returns {string} - Truncated text
 */
export function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) return text || '';
  return text.substring(0, maxLength - suffix.length) + suffix;
}
