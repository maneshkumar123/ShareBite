import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@hooks/index';
import { ROUTES } from '@utils/constants';
import { RootLayout } from '@components/layout/MainLayout';
import { DashboardLayout } from '@components/dashboard';

// Public Pages
import HomePage from '@pages/HomePage';
import LoginPage from '@pages/auth/LoginPage';
import RegisterPage from '@pages/auth/RegisterPage';
import VerifyEmail from '@pages/auth/VerifyEmail';
import AuthSuccess from '@pages/auth/AuthSuccess';
import ForgotPassword from '@pages/auth/ForgotPassword';

// Profile Setup (Auth Required, No Profile Required)
import ProfileSetup from '@pages/ProfileSetup';

// Protected Pages - Donor
import DonorDashboard from '@pages/donor/DonorDashboard';
import CreateListing from '@pages/donor/CreateListing';
import MyListings from '@pages/donor/MyListings';
import DonorProfile from '@pages/donor/DonorProfile';

// Protected Pages - Recipient
import RecipientDashboard from '@pages/recipient/RecipientDashboard';

// ==============================================
// PROTECTED ROUTE WRAPPER
// ==============================================

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'donor' | 'recipient';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    const currentPath = window.location.pathname;

    // Check auth first - if not authenticated, redirect immediately
    // This prevents showing loading screen during logout
    if (!isAuthenticated && !isLoading) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    // Only show loading if we're checking initial auth
    if (isLoading) {
        return (
            <div className="loading-screen" style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#121212',
                color: '#F7F7F7',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🍽️</div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated after loading
    if (!isAuthenticated) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    // Check if profile is complete (unless we're on the profile setup page)
    if (user && !user.hasCompletedProfile && currentPath !== ROUTES.PROFILE_SETUP) {
        return <Navigate to={ROUTES.PROFILE_SETUP} replace />;
    }

    if (requiredRole && user?.role !== requiredRole) {
        // Redirect to appropriate dashboard
        if (user?.role === 'donor') {
            return <Navigate to={ROUTES.DONOR_DASHBOARD} replace />;
        }
        if (user?.role === 'recipient') {
            return <Navigate to={ROUTES.RECIPIENT_DASHBOARD} replace />;
        }
        return <Navigate to={ROUTES.HOME} replace />;
    }

    return <>{children}</>;
};

// ==============================================
// DASHBOARD LAYOUT WRAPPERS
// ==============================================

const DonorDashboardLayout: React.FC = () => {
    return (
        <ProtectedRoute requiredRole="donor">
            <DashboardLayout userRole="donor" />
        </ProtectedRoute>
    );
};

const RecipientDashboardLayout: React.FC = () => {
    return (
        <ProtectedRoute requiredRole="recipient">
            <DashboardLayout userRole="recipient" />
        </ProtectedRoute>
    );
};

// ==============================================
// APP ROUTER
// ==============================================

export const AppRouter: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Routes - With Header/Footer */}
                <Route element={<RootLayout />}>
                    <Route path={ROUTES.HOME} element={<HomePage />} />
                    <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                    <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
                    <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmail />} />
                    <Route path={ROUTES.AUTH_SUCCESS} element={<AuthSuccess />} />
                    <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
                </Route>

                {/* Profile Setup - Auth Required, No Dashboard Layout */}
                <Route
                    path={ROUTES.PROFILE_SETUP}
                    element={
                        <ProtectedRoute>
                            <ProfileSetup />
                        </ProtectedRoute>
                    }
                />

                {/* Donor Dashboard Routes - With Sidebar Layout */}
                <Route element={<DonorDashboardLayout />}>
                    <Route path={ROUTES.DONOR_DASHBOARD} element={<DonorDashboard />} />
                    <Route path={ROUTES.CREATE_LISTING} element={<CreateListing />} />
                    <Route path="/donor/listings" element={<MyListings />} />
                    <Route path={ROUTES.PROFILE} element={<DonorProfile />} />
                </Route>

                {/* Recipient Dashboard Routes - With Sidebar Layout */}
                <Route element={<RecipientDashboardLayout />}>
                    <Route path={ROUTES.RECIPIENT_DASHBOARD} element={<RecipientDashboard />} />
                    <Route path={ROUTES.BROWSE_LISTINGS} element={<BrowseListingsPlaceholder />} />
                    <Route path="/recipient/profile" element={<RecipientProfilePlaceholder />} />
                </Route>

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
};

// ==============================================
// PLACEHOLDER COMPONENTS (recipient pages — pending)
// ==============================================

const BrowseListingsPlaceholder: React.FC = () => (
    <div style={{ padding: '2rem', color: '#F7F7F7' }}>
        <h2>Browse Listings</h2>
        <p style={{ color: '#888' }}>Coming soon...</p>
    </div>
);

const RecipientProfilePlaceholder: React.FC = () => (
    <div style={{ padding: '2rem', color: '#F7F7F7' }}>
        <h2>Profile</h2>
        <p style={{ color: '#888' }}>Coming soon...</p>
    </div>
);

const NotFoundPage: React.FC = () => (
    <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#121212',
        color: '#F7F7F7',
        fontFamily: 'Inter, sans-serif',
    }}>
        <h1 style={{ fontSize: '72px', margin: 0, color: '#7DFF12' }}>404</h1>
        <p style={{ fontSize: '18px', color: '#888' }}>Page not found</p>
    </div>
);
