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
import AuthSuccess from '@pages/auth/AuthSuccess';
import ForgotPassword from '@pages/auth/ForgotPassword';

// Protected Pages - Donor
import DonorDashboard from '@pages/donor/DonorDashboard';

// ==============================================
// PROTECTED ROUTE WRAPPER
// ==============================================

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'donor' | 'recipient';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { isAuthenticated, user, isLoading } = useAuth();

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

    if (requiredRole && user?.role !== requiredRole) {
        // Redirect to appropriate dashboard
        if (user?.role === 'donor') {
            return <Navigate to={ROUTES.DONOR_DASHBOARD} replace />;
        }
        return <Navigate to={ROUTES.HOME} replace />;
    }

    return <>{children}</>;
};

// ==============================================
// DONOR DASHBOARD LAYOUT WRAPPER
// ==============================================

const DonorDashboardLayout: React.FC = () => {
    return (
        <ProtectedRoute requiredRole="donor">
            <DashboardLayout userRole="donor" />
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
                    <Route path={ROUTES.AUTH_SUCCESS} element={<AuthSuccess />} />
                    <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
                </Route>

                {/* Donor Dashboard Routes - With Sidebar Layout */}
                <Route element={<DonorDashboardLayout />}>
                    <Route path={ROUTES.DONOR_DASHBOARD} element={<DonorDashboard />} />
                    <Route path={ROUTES.CREATE_LISTING} element={<CreateListingPlaceholder />} />
                    <Route path="/donor/listings" element={<MyListingsPlaceholder />} />
                    <Route path={ROUTES.PROFILE} element={<ProfilePlaceholder />} />
                </Route>

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
};

// ==============================================
// PLACEHOLDER COMPONENTS (to be replaced)
// ==============================================

const CreateListingPlaceholder: React.FC = () => (
    <div style={{ padding: '2rem', color: '#F7F7F7' }}>
        <h2>Create Listing</h2>
        <p style={{ color: '#888' }}>Coming soon...</p>
    </div>
);

const MyListingsPlaceholder: React.FC = () => (
    <div style={{ padding: '2rem', color: '#F7F7F7' }}>
        <h2>My Listings</h2>
        <p style={{ color: '#888' }}>Coming soon...</p>
    </div>
);

const ProfilePlaceholder: React.FC = () => (
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
