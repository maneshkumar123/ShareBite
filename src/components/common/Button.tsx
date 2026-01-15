import React from 'react';
import './Button.css';

export interface ButtonProps {
    children: React.ReactNode;
    onClick?: () => void;
    type?: 'button' | 'submit' | 'reset';
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
    isLoading?: boolean;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    onClick,
    type = 'button',
    variant = 'primary',
    disabled = false,
    isLoading = false,
    fullWidth = false,
}) => {
    const className = `btn btn-${variant} ${fullWidth ? 'btn-full-width' : ''} ${isLoading ? 'btn-loading' : ''
        }`;

    return (
        <button
            type={type}
            className={className}
            onClick={onClick}
            disabled={disabled || isLoading}
        >
            {isLoading ? 'Loading...' : children}
        </button>
    );
};
