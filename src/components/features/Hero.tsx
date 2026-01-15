import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '@utils/constants';
import heroVideo from '@assets/heroVideo.mp4';
import './Hero.css';

// Rotating phrases for the last title line
const ROTATING_PHRASES = ['IN NEED.', 'NEAR YOU.', 'WHO CARE.', 'TODAY.'];

// Hero images for carousel (COMMENTED OUT - TESTING VIDEO)
/*
const HERO_IMAGES = [
  {
    src: '/src/assets/hero_fresh_food.png',
    alt: 'Fresh gourmet food representing surplus meals',
  },
  {
    src: '/src/assets/hero_network_connection.png',
    alt: 'Network connections showing real-time matching',
  },
  {
    src: '/src/assets/hero_community_sharing.png',
    alt: 'Community sharing food with those in need',
  },
];
*/

export const Hero: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
    // const [currentImageIndex, setCurrentImageIndex] = useState(0); // COMMENTED - TESTING VIDEO

    useEffect(() => {
        // Trigger animation after component mounts
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 100);

        return () => clearTimeout(timer);
    }, []);

    // Rotate through phrases continuously
    useEffect(() => {
        const rotationInterval = setInterval(() => {
            setCurrentPhraseIndex(prev => (prev + 1) % ROTATING_PHRASES.length);
        }, 3000); // Change phrase every 3 seconds

        return () => clearInterval(rotationInterval);
    }, []);

    // Rotate through images continuously (COMMENTED - TESTING VIDEO)
    /*
    useEffect(() => {
      const imageRotationInterval = setInterval(() => {
        setCurrentImageIndex(prev => (prev + 1) % HERO_IMAGES.length);
      }, 5000); // Change image every 5 seconds
  
      return () => clearInterval(imageRotationInterval);
    }, []);
    */

    return (
        <section className="hero-section">
            <div className="hero-container">
                <div className="hero-content">
                    {/* Left Side - Animated Title */}
                    <div className="hero-text-wrapper">
                        <div className={`hero-title-container ${isVisible ? 'animate-in' : ''}`}>
                            <h1 className="hero-title-line">CONNECTING</h1>
                        </div>
                        <div
                            className={`hero-title-container ${isVisible ? 'animate-in' : ''}`}
                            style={{ animationDelay: '0.1s' }}
                        >
                            <h1 className="hero-title-line">SURPLUS</h1>
                        </div>
                        <div
                            className={`hero-title-container ${isVisible ? 'animate-in' : ''}`}
                            style={{ animationDelay: '0.2s' }}
                        >
                            <h1 className="hero-title-line">WITH THOSE</h1>
                        </div>

                        {/* Rotating Text Line */}
                        <div
                            className={`hero-title-container rotating-container ${isVisible ? 'animate-in' : ''}`}
                            style={{ animationDelay: '0.3s' }}
                        >
                            <div className="rotating-text-wrapper">
                                {ROTATING_PHRASES.map((phrase, index) => (
                                    <h1
                                        key={phrase}
                                        className={`hero-title-line rotating-phrase ${index === currentPhraseIndex ? 'active' : ''
                                            } ${index === (currentPhraseIndex - 1 + ROTATING_PHRASES.length) % ROTATING_PHRASES.length
                                                ? 'exiting'
                                                : ''
                                            }`}
                                    >
                                        {phrase}
                                    </h1>
                                ))}
                            </div>
                        </div>

                        {/* Subtitle */}
                        <p
                            className={`hero-subtitle ${isVisible ? 'animate-in' : ''}`}
                            style={{ animationDelay: '0.6s' }}
                        >
                            ShareBite connects restaurants and cafés with local charities and individuals,
                            ensuring surplus food reaches those who need it before it expires.
                        </p>

                        {/* CTA Buttons */}
                        <div
                            className={`hero-cta-container ${isVisible ? 'animate-in' : ''}`}
                            style={{ animationDelay: '0.8s' }}
                        >
                            <Link to={ROUTES.REGISTER} className="hero-cta-primary">
                                Get Started
                            </Link>
                            <Link to={ROUTES.LOGIN} className="hero-cta-secondary">
                                Sign In
                            </Link>
                        </div>
                    </div>

                    {/* Right Side - VIDEO CARD (TESTING) */}
                    <div
                        className={`hero-video-card ${isVisible ? 'animate-in-right' : ''}`}
                        style={{ animationDelay: '0.4s' }}
                    >
                        <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="hero-video"
                        >
                            <source src={heroVideo} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>

                    {/* Right Side - Rotating Image Carousel (COMMENTED - TESTING VIDEO) */}
                    {/*
          <div
            className={`hero-image-carousel ${isVisible ? 'animate-in-right' : ''}`}
            style={{ animationDelay: '0.4s' }}
          >
            <div className="image-carousel-wrapper">
              {HERO_IMAGES.map((image, index) => (
                <div
                  key={index}
                  className={`carousel-image ${index === currentImageIndex ? 'active' : ''} ${
                    index === (currentImageIndex - 1 + HERO_IMAGES.length) % HERO_IMAGES.length
                      ? 'exiting'
                      : ''
                  }`}
                >
                  <img src={image.src} alt={image.alt} />
                </div>
              ))}
            </div>
          </div>
          */}
                </div>
            </div>
        </section>
    );
};
