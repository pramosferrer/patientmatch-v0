// /frontend/lib/validation/schemas.js
// Input validation schemas for API endpoints

export const patientDataSchema = {
  // Required fields
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z\s\-'\.]+$/
  },
  email: {
    type: 'string',
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  phone: {
    type: 'string',
    required: false,
    pattern: /^[\+]?[1-9][\d]{0,15}$/
  },
  patient_age: {
    type: 'string',
    required: true,
    pattern: /^\d+$/
  },
  patient_diagnosis_namd: {
    type: 'string',
    required: true,
    enum: ['yes', 'no']
  },
  patient_condition_glaucoma: {
    type: 'string',
    required: true,
    enum: ['yes', 'no']
  }
};

export function validatePatientData(data) {
  const errors = [];
  
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    errors.push('Request body must be a valid JSON object');
    return { isValid: false, errors };
  }
  
  // Validate each field
  for (const [fieldName, rules] of Object.entries(patientDataSchema)) {
    const value = data[fieldName];
    
    // Check required fields
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${fieldName} is required`);
      continue;
    }
    
    // Skip validation for optional fields that are not provided
    if (!rules.required && (value === undefined || value === null || value === '')) {
      continue;
    }
    
    // Check type
    if (rules.type && typeof value !== rules.type) {
      errors.push(`${fieldName} must be a ${rules.type}`);
      continue;
    }
    
    // Check string length constraints
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${fieldName} must be at least ${rules.minLength} characters long`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${fieldName} must be no more than ${rules.maxLength} characters long`);
      }
    }
    
    // Check pattern
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push(`${fieldName} format is invalid`);
    }
    
    // Check enum values
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`${fieldName} must be one of: ${rules.enum.join(', ')}`);
    }
  }
  
  // Check for unknown fields (security: prevent injection of unexpected data)
  const allowedFields = Object.keys(patientDataSchema);
  const providedFields = Object.keys(data);
  const unknownFields = providedFields.filter(field => !allowedFields.includes(field));
  
  if (unknownFields.length > 0) {
    errors.push(`Unknown fields not allowed: ${unknownFields.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function sanitizePatientData(data) {
  const sanitized = {};
  
  for (const [fieldName, rules] of Object.entries(patientDataSchema)) {
    const value = data[fieldName];
    
    if (value !== undefined && value !== null) {
      if (rules.type === 'string') {
        // Basic XSS prevention
        sanitized[fieldName] = String(value).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      } else {
        sanitized[fieldName] = value;
      }
    }
  }
  
  return sanitized;
}
