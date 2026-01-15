/**
 * Donor Dashboard Page
 * 
 * Main dashboard view for donors showing:
 * - Stats overview (total listings, claimed, impact)
 * - Recent listings
 * - Quick action buttons
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { StatsCard } from '@components/common';
import { Button } from '@components/common';
import { Card, CardHeader, CardBody } from '@components/common';
import { ROUTES } from '@utils/constants';
import './DonorDashboard.css';

// Stats icon components
const ListingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
);

const ClaimedIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const MealsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
        <line x1="6" y1="1" x2="6" y2="4" />
        <line x1="10" y1="1" x2="10" y2="4" />
        <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
);

const ImpactIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
    </svg>
);

interface DashboardStats {
    totalListings: number;
    activeListing: number;
    claimedListings: number;
    mealsShared: number;
}

const DonorDashboard: React.FC = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState<DashboardStats>({
        totalListings: 0,
        activeListing: 0,
        claimedListings: 0,
        mealsShared: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // TODO: Fetch real stats from listingService
        const loadStats = async () => {
            try {
                // Simulated stats for now
                await new Promise(resolve => setTimeout(resolve, 500));
                setStats({
                    totalListings: 0,
                    activeListing: 0,
                    claimedListings: 0,
                    mealsShared: 0,
                });
            } catch (error) {
                console.error('Error loading stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadStats();
    }, []);

    const greeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    return (
        <div className="donor-dashboard">
            {/* Welcome Section */}
            <div className="donor-dashboard__welcome">
                <h2 className="donor-dashboard__greeting">
                    {greeting()}, {user?.fullName?.split(' ')[0] || 'there'}! 👋
                </h2>
                <p className="donor-dashboard__subtitle">
                    Ready to make a difference today?
                </p>
            </div>

            {/* Stats Grid */}
            <div className="donor-dashboard__stats">
                <StatsCard
                    icon={<ListingsIcon />}
                    value={isLoading ? '...' : stats.totalListings}
                    label="Total Listings"
                    color="accent"
                />
                <StatsCard
                    icon={<ClaimedIcon />}
                    value={isLoading ? '...' : stats.claimedListings}
                    label="Claimed"
                    color="success"
                />
                <StatsCard
                    icon={<MealsIcon />}
                    value={isLoading ? '...' : stats.mealsShared}
                    label="Meals Shared"
                    color="warning"
                />
                <StatsCard
                    icon={<ImpactIcon />}
                    value={isLoading ? '...' : stats.activeListing}
                    label="Active Now"
                    color="accent"
                />
            </div>

            {/* Quick Actions */}
            <Card className="donor-dashboard__actions-card">
                <CardHeader>
                    <h3>Quick Actions</h3>
                    <p>Start sharing food with your community</p>
                </CardHeader>
                <CardBody>
                    <div className="donor-dashboard__actions">
                        <Link to={ROUTES.CREATE_LISTING}>
                            <Button variant="primary" size="lg" fullWidth>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="16" />
                                    <line x1="8" y1="12" x2="16" y2="12" />
                                </svg>
                                Create New Listing
                            </Button>
                        </Link>
                        <Link to="/donor/listings">
                            <Button variant="secondary" size="lg" fullWidth>
                                View All Listings
                            </Button>
                        </Link>
                    </div>
                </CardBody>
            </Card>

            {/* Recent Activity Placeholder */}
            <Card className="donor-dashboard__recent">
                <CardHeader>
                    <h3>Recent Activity</h3>
                </CardHeader>
                <CardBody>
                    <div className="donor-dashboard__empty-state">
                        <div className="donor-dashboard__empty-icon">🍽️</div>
                        <h4>No listings yet</h4>
                        <p>Create your first food listing to start sharing with your community.</p>
                        <Link to={ROUTES.CREATE_LISTING}>
                            <Button variant="primary">Create Listing</Button>
                        </Link>
                    </div>
                </CardBody>
            </Card>
        </div>
    );
};

export default DonorDashboard;
