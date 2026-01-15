import React from 'react';
import { Hero } from '@components/features/Hero';
import { HowItWorks } from '@components/features/HowItWorks';
import { WhyShareBite } from '@components/features/WhyShareBite';
import './HomePage.css';

/**
 * HomePage - Content only (no layout wrapper)
 * 
 * Layout (Header/Footer) is handled by RootLayout in AppRouter.
 * This component only renders the page-specific content.
 */
const HomePage: React.FC = () => {
    return (
        <div className="home-page">
            {/* Premium Hero Section with Creative Apes Design */}
            <Hero />

            {/* Premium How It Works Section - Creative Apes Featured Projects Style */}
            <HowItWorks />

            {/* Why ShareBite Section - Innovation in Motion Style */}
            <WhyShareBite />
        </div>
    );
};

export default HomePage;
