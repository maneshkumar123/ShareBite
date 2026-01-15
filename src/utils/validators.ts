import { VALIDATION_MESSAGES, MIN_PASSWORD_LENGTH } from './constants';

// Email validation
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Password validation
export const isValidPassword = (password: string): boolean => {
    return password.length >= MIN_PASSWORD_LENGTH;
};

// Phone validation (basic)
export const isValidPhone = (phone: string): boolean => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

// Form field validation
export const validateField = (
    name: string,
    value: string,
    type?: 'email' | 'password' | 'phone'
): string | null => {
    if (!value || value.trim() === '') {
        return VALIDATION_MESSAGES.REQUIRED_FIELD;
    }

    if (type === 'email' && !isValidEmail(value)) {
        return VALIDATION_MESSAGES.INVALID_EMAIL;
    }

    if (type === 'password' && !isValidPassword(value)) {
        return VALIDATION_MESSAGES.PASSWORD_TOO_SHORT;
    }

    if (type === 'phone' && !isValidPhone(value)) {
        return VALIDATION_MESSAGES.INVALID_PHONE;
    }

    return null;
};
