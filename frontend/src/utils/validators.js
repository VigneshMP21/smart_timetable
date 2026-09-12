const ALLOWED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate an Excel file for upload.
 * Returns { valid: boolean, error: string|null }.
 */
export function validateExcelFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    return { valid: false, error: 'Invalid file type. Please upload an .xlsx or .xls file.' };
  }

  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit.' };
  }

  return { valid: true, error: null };
}

/**
 * Validate that preview data is complete.
 */
export function validatePreviewData(data) {
  const errors = [];

  if (!data) {
    errors.push('No data available. Please upload an Excel file first.');
    return { valid: false, errors };
  }

  if (!data.classes || data.classes.length === 0) {
    errors.push('No classes found in the uploaded file.');
  }

  if (!data.subjects || data.subjects.length === 0) {
    errors.push('No subjects found in the uploaded file.');
  }

  if (!data.faculty || data.faculty.length === 0) {
    errors.push('No faculty members found in the uploaded file.');
  }

  if (!data.constraints) {
    errors.push('No constraints found in the uploaded file.');
  }

  return { valid: errors.length === 0, errors };
}

/* ============================================
   AUTH VALIDATORS
   ============================================ */

/**
 * Validate name field.
 * @param {string} name
 * @returns {{ valid: boolean, error: string }}
 */
export function validateName(name) {
  if (!name || !name.trim()) return { valid: false, error: 'Name is required.' };
  if (name.trim().length < 3) return { valid: false, error: 'Name must be at least 3 characters.' };
  return { valid: true, error: '' };
}

/**
 * Validate email field.
 * @param {string} email
 * @returns {{ valid: boolean, error: string }}
 */
export function validateEmail(email) {
  if (!email || !email.trim()) return { valid: false, error: 'Email is required.' };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return { valid: false, error: 'Please enter a valid email address.' };
  return { valid: true, error: '' };
}

/**
 * Validate phone field (10 digits).
 * @param {string} phone
 * @returns {{ valid: boolean, error: string }}
 */
export function validatePhone(phone) {
  if (!phone || !phone.trim()) return { valid: false, error: 'Phone number is required.' };
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) return { valid: false, error: 'Phone number must be 10 digits.' };
  return { valid: true, error: '' };
}

/**
 * Validate password strength.
 * @param {string} password
 * @returns {{ valid: boolean, error: string, strength: 'weak'|'medium'|'strong' }}
 */
export function validatePassword(password) {
  if (!password) return { valid: false, error: 'Password is required.', strength: 'weak' };

  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const strength = score <= 2 ? 'weak' : score <= 3 ? 'medium' : 'strong';

  if (password.length < 8) return { valid: false, error: 'Password must be at least 8 characters.', strength };
  if (!/[A-Z]/.test(password)) return { valid: false, error: 'Include at least one uppercase letter.', strength };
  if (!/[a-z]/.test(password)) return { valid: false, error: 'Include at least one lowercase letter.', strength };
  if (!/[0-9]/.test(password)) return { valid: false, error: 'Include at least one number.', strength };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, error: 'Include at least one special character.', strength };

  return { valid: true, error: '', strength };
}

/**
 * Validate confirm password matches.
 * @param {string} password
 * @param {string} confirm
 * @returns {{ valid: boolean, error: string }}
 */
export function validateConfirmPassword(password, confirm) {
  if (!confirm) return { valid: false, error: 'Please confirm your password.' };
  if (password !== confirm) return { valid: false, error: 'Passwords do not match.' };
  return { valid: true, error: '' };
}

/**
 * Validate full login form.
 * @param {{ email: string, password: string }} values
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateLoginForm(values) {
  const errors = {};
  const emailResult = validateEmail(values.email);
  if (!emailResult.valid) errors.email = emailResult.error;
  if (!values.password) errors.password = 'Password is required.';
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate full registration form.
 * @param {Object} values
 * @returns {{ valid: boolean, errors: Object }}
 */
export function validateRegisterForm(values) {
  const errors = {};

  const nameResult = validateName(values.name);
  if (!nameResult.valid) errors.name = nameResult.error;

  const emailResult = validateEmail(values.email);
  if (!emailResult.valid) errors.email = emailResult.error;

  if (values.phone) {
    const phoneResult = validatePhone(values.phone);
    if (!phoneResult.valid) errors.phone = phoneResult.error;
  }

  const pwResult = validatePassword(values.password);
  if (!pwResult.valid) errors.password = pwResult.error;

  const cpwResult = validateConfirmPassword(values.password, values.confirmPassword);
  if (!cpwResult.valid) errors.confirmPassword = cpwResult.error;

  return { valid: Object.keys(errors).length === 0, errors };
}
