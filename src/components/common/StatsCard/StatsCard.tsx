/**
 * StatsCard Component
 * 
 * Dashboard stat display with icon, value, label, and optional trend.
 */

import React from 'react';
import './StatsCard.css';

interface StatsCardProps {
    icon: React.ReactNode;
    value: string | number;
    label: string;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'accent' | 'success' | 'warning' | 'error';
}

export const StatsCard: React.FC<StatsCardProps> = ({
    icon,
    value,
    label,
    trend,
    color = 'accent',
}) => {
    return (
        <div className={`stats-card stats-card--${color}`}>
            <div className="stats-card__icon">{icon}</div>
            <div className="stats-card__content">
                <div className="stats-card__value">{value}</div>
                <div className="stats-card__label">{label}</div>
                {trend && (
                    <div className={`stats-card__trend ${trend.isPositive ? 'stats-card__trend--positive' : 'stats-card__trend--negative'}`}>
                        <span className="stats-card__trend-arrow">
                            {trend.isPositive ? '↑' : '↓'}
                        </span>
                        <span>{Math.abs(trend.value)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};
