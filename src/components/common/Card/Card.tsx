/**
 * Card Component
 * 
 * Flexible card container with optional header and footer.
 * Uses glassmorphism styling from design system.
 */

import React from 'react';
import './Card.css';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hover?: boolean;
}

interface CardHeaderProps {
    children: React.ReactNode;
    className?: string;
    action?: React.ReactNode;
}

interface CardBodyProps {
    children: React.ReactNode;
    className?: string;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
    hover = false,
}) => {
    const classes = [
        'card',
        `card--padding-${padding}`,
        hover && 'card--hover',
        className,
    ].filter(Boolean).join(' ');

    return <div className={classes}>{children}</div>;
};

export const CardHeader: React.FC<CardHeaderProps> = ({
    children,
    className = '',
    action,
}) => {
    return (
        <div className={`card__header ${className}`}>
            <div className="card__header-content">{children}</div>
            {action && <div className="card__header-action">{action}</div>}
        </div>
    );
};

export const CardBody: React.FC<CardBodyProps> = ({
    children,
    className = '',
}) => {
    return <div className={`card__body ${className}`}>{children}</div>;
};
