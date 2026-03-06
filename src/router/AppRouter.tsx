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

// OAuth Pages (No Layout Wrapper)
import AuthCallback from '@pages/auth/AuthCallback';
import GoogleSetup from '@pages/auth/GoogleSetup';

// Profile Setup (Auth Required, No Profile Required)
import ProfileSetup from '@pages/ProfileSetup';

// Protected Pages - Donor
import DonorDashboard from '@pages/donor/DonorDashboard';
import CreateListing from '@pages/donor/CreateListing';
import MyListings from '@pages/donor/MyListings';
import DonorProfile from '@pages/donor/DonorProfile';

// Protected Pages - Recipient
import RecipientDashboard from '@pages/recipient/RecipientDashboard';
import BrowseListings from '@pages/recipient/BrowseListings';
import RecipientProfile from '@pages/recipient/RecipientProfile';
import DonorRequests from '@pages/donor/DonorRequests';
import RecipientRequests from '@pages/recipient/RecipientRequests';

// Protected Pages - Listing Detail
import ListingDetailPage from '@pages/listing/ListingDetailPage';

// Common
import NotFoundPage from '@pages/NotFoundPage';

// ==============================================
// PROTECTED ROUTE WRAPPER
// ==============================================

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'donor' | 'recipient';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
    const { isAuthenticated, user, isLoading, isProfileLoading } = useAuth();
    const currentPath = window.location.pathname;

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

    if (!isAuthenticated) {
        return <Navigate to={ROUTES.LOGIN} replace />;
    }

    // Don't redirect to profile setup until the DB profile fetch is complete —
    // otherwise a reload will flash /profile-setup before hasCompletedProfile is known.
    if (!isProfileLoading && user && !user.hasCompletedProfile && currentPath !== ROUTES.PROFILE_SETUP) {
        return <Navigate to={ROUTES.PROFILE_SETUP} replace />;
    }

    if (requiredRole && user?.role !== requiredRole) {
        if (user?.role === 'donor') return <Navigate to={ROUTES.DONOR_DASHBOARD} replace />;
        if (user?.role === 'recipient') return <Navigate to={ROUTES.RECIPIENT_DASHBOARD} replace />;
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

// Layout for pages accessible to both donors and recipients
const SharedDashboardLayout: React.FC = () => {
    const { user } = useAuth();
    const role = user?.role ?? 'recipient';
    return (
        <ProtectedRoute>
            <DashboardLayout userRole={role} />
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

                {/* OAuth Callback & Google Setup - Standalone, No Layout */}
                <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
                <Route path={ROUTES.GOOGLE_SETUP} element={<GoogleSetup />} />

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
                    <Route path="/donor" element={<Navigate to={ROUTES.DONOR_DASHBOARD} replace />} />
                    <Route path={ROUTES.DONOR_DASHBOARD} element={<DonorDashboard />} />
                    <Route path={ROUTES.CREATE_LISTING} element={<CreateListing />} />
                    <Route path={ROUTES.MY_LISTINGS} element={<MyListings />} />
                    <Route path={ROUTES.DONOR_REQUESTS} element={<DonorRequests />} />
                    <Route path={ROUTES.PROFILE} element={<DonorProfile />} />
                </Route>

                {/* Recipient Dashboard Routes - With Sidebar Layout */}
                <Route element={<RecipientDashboardLayout />}>
                    <Route path="/recipient" element={<Navigate to={ROUTES.RECIPIENT_DASHBOARD} replace />} />
                    <Route path={ROUTES.RECIPIENT_DASHBOARD} element={<RecipientDashboard />} />
                    <Route path={ROUTES.BROWSE_LISTINGS} element={<BrowseListings />} />
                    <Route path={ROUTES.RECIPIENT_REQUESTS} element={<RecipientRequests />} />
                    <Route path={ROUTES.RECIPIENT_PROFILE} element={<RecipientProfile />} />
                </Route>

                {/* Listing Detail - accessible to both roles */}
                <Route element={<SharedDashboardLayout />}>
                    <Route path="/listing/:id" element={<ListingDetailPage />} />
                </Route>

                {/* 404 Route */}
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </BrowserRouter>
    );
};
