/**
 * Button Component
 * 
 * Reusable button with multiple variants and sizes.
 * Uses design tokens for consistent styling.
 */

import React from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className = '',
    ...props
}) => {
    const classes = [
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full-width',
        isLoading && 'btn--loading',
        className,
    ].filter(Boolean).join(' ');

    return (
        <button
            className={classes}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <span className="btn__spinner" />}
            {!isLoading && leftIcon && <span className="btn__icon btn__icon--left">{leftIcon}</span>}
            <span className="btn__text">{children}</span>
            {!isLoading && rightIcon && <span className="btn__icon btn__icon--right">{rightIcon}</span>}
        </button>
    );
};
