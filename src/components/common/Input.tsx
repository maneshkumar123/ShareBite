import React from 'react';
import './Input.css';

export interface InputProps {
    label?: string;
    type?: string;
    name: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    error?: string | null;
    required?: boolean;
    disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
    label,
    type = 'text',
    name,
    value,
    onChange,
    placeholder,
    error,
    required = false,
    disabled = false,
}) => {
    return (
        <div className="input-group">
            {label && (
                <label htmlFor={name} className="input-label">
                    {label}
                    {required && <span className="required">*</span>}
                </label>
            )}
            <input
                type={type}
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                className={`input ${error ? 'input-error' : ''}`}
            />
            {error && <span className="error-message">{error}</span>}
        </div>
    );
};
