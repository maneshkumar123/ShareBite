import React from 'react';
import { useAuth } from '@contexts/AuthContext';
import { StatsCard } from '@components/common';
import './RecipientDashboard.css';

// Stats icon components
const ClaimedIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const NearbyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const CalendarIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const RecipientDashboard: React.FC = () => {
    const { user } = useAuth();

    return (
        <div className="recipient-dashboard">
            <div className="recipient-dashboard__header">
                <h1>Welcome back, {user?.fullName?.split(' ')[0] || 'there'} 👋</h1>
                <p className="recipient-dashboard__subtitle">
                    Find and claim surplus food near you
                </p>
            </div>

            <div className="recipient-dashboard__stats">
                <StatsCard
                    icon={<ClaimedIcon />}
                    value={0}
                    label="Meals Claimed"
                    color="success"
                />
                <StatsCard
                    icon={<NearbyIcon />}
                    value={0}
                    label="Nearby Listings"
                    color="accent"
                />
                <StatsCard
                    icon={<CalendarIcon />}
                    value={0}
                    label="This Month"
                    color="warning"
                />
            </div>

            <div className="recipient-dashboard__empty">
                <div className="recipient-dashboard__empty-icon">🍽️</div>
                <h3>No listings near you yet</h3>
                <p>When donors post surplus food in your area, it will appear here.</p>
            </div>
        </div>
    );
};

export default RecipientDashboard;
