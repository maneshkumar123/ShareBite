import React from 'react';
import './Card.css';

export interface CardProps {
    children: React.ReactNode;
    padding?: 'small' | 'medium' | 'large';
    shadow?: boolean;
    hover?: boolean;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    children,
    padding = 'medium',
    shadow = true,
    hover = false,
    onClick,
}) => {
    const className = `card card-${padding} ${shadow ? 'card-shadow' : ''} ${hover ? 'card-hover' : ''
        } ${onClick ? 'card-clickable' : ''}`;

    return (
        <div className={className} onClick={onClick}>
            {children}
        </div>
    );
};
