import React from 'react';
import './FormField.css';

export interface FormFieldConfig {
    name: string;
    type: 'text' | 'email' | 'password' | 'tel' | 'select' | 'textarea';
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    autoComplete?: string;
}

interface FormFieldProps {
    field: FormFieldConfig;
    value: string;
    onChange: (name: string, value: string) => void;
    onBlur?: (name: string) => void;
    error?: string;
    disabled?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
    field,
    value,
    onChange,
    onBlur,
    error,
    disabled = false,
}) => {
    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        onChange(field.name, e.target.value);
    };

    const handleBlur = () => {
        if (onBlur) {
            onBlur(field.name);
        }
    };

    const inputClassName = `form-field-input ${error ? 'has-error' : ''} ${disabled ? 'disabled' : ''}`;

    const renderInput = () => {
        if (field.type === 'select' && field.options) {
            return (
                <select
                    id={field.name}
                    name={field.name}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    className={inputClassName}
                    required={field.required}
                >
                    <option value="">{field.placeholder || 'Select...'}</option>
                    {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            );
        }

        if (field.type === 'textarea') {
            return (
                <textarea
                    id={field.name}
                    name={field.name}
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={field.placeholder}
                    disabled={disabled}
                    className={inputClassName}
                    required={field.required}
                    rows={4}
                />
            );
        }

        return (
            <input
                type={field.type}
                id={field.name}
                name={field.name}
                value={value}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder={field.placeholder}
                disabled={disabled}
                className={inputClassName}
                required={field.required}
                autoComplete={field.autoComplete}
            />
        );
    };

    return (
        <div className="form-field">
            <label htmlFor={field.name} className="form-field-label">
                {field.label}
                {field.required && <span className="form-field-required">*</span>}
            </label>
            {renderInput()}
            {error && <span className="form-field-error">{error}</span>}
        </div>
    );
};
