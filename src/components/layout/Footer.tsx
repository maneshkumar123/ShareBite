import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Footer.css';

export const Footer: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const scrollToSection = (sectionId: string) => {
        if (location.pathname !== '/') {
            navigate('/', { state: { scrollTo: sectionId } });
        } else {
            const el = document.getElementById(sectionId);
            el?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });

    const [errors, setErrors] = useState({
        name: '',
        email: '',
        message: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);

    // Handle scroll to show/hide scroll-to-top button
    useEffect(() => {
        const handleScroll = () => {
            setShowScrollTop(window.scrollY > 300);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Scroll to top handler
    const scrollToTop = () => {
        const startPosition = window.scrollY;
        const startTime = performance.now();
        const duration = 800;

        const scroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing: easeInOutCubic
            const easeProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            const newPosition = startPosition * (1 - easeProgress);
            window.scrollTo(0, newPosition);

            if (progress < 1) {
                requestAnimationFrame(scroll);
            }
        };

        requestAnimationFrame(scroll);
    };

    // Validation functions
    const validateName = (value: string): string => {
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return '';
    };

    const validateEmail = (value: string): string => {
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return 'Please enter a valid email';
        return '';
    };

    const validateMessage = (value: string): string => {
        if (!value.trim()) return 'Message is required';
        if (value.trim().length < 10) return 'Message must be at least 10 characters';
        return '';
    };

    // Handle input changes
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Clear error when user starts typing
        if (errors[name as keyof typeof errors]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    // Handle input blur
    const handleInputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        let error = '';

        switch (name) {
            case 'name':
                error = validateName(value);
                break;
            case 'email':
                error = validateEmail(value);
                break;
            case 'message':
                error = validateMessage(value);
                break;
        }

        setErrors(prev => ({ ...prev, [name]: error }));
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate all fields
        const nameError = validateName(formData.name);
        const emailError = validateEmail(formData.email);
        const messageError = validateMessage(formData.message);

        setErrors({
            name: nameError,
            email: emailError,
            message: messageError
        });

        if (nameError || emailError || messageError) {
            return;
        }

        setIsSubmitting(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Success - reset form
            setFormData({ name: '', email: '', message: '' });
            alert('Message sent successfully!');
        } catch (error) {
            alert('Failed to send message. Please try again.');
            console.error('Form submission error:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <footer className="footer">
            <div className="footer-container">
                {/* Header Section */}
                <div className="footer-header">
                    <h2 className="footer-header-title">
                        © Get in touch <span className="footer-header-meta">(ShareBite — 2026)</span>
                    </h2>
                </div>

                {/* Contact Section */}
                <div id="contact" className="footer-contact">
                    <h2 className="footer-contact-heading">
                        Let's create something amazing together!
                    </h2>
                    <p className="footer-contact-subtext">
                        Reach out we'd love to hear about your project and ideas.
                    </p>

                    {/* Contact Form */}
                    <form onSubmit={handleSubmit} className="footer-form">
                        <div className="form-field">
                            <input
                                type="text"
                                name="name"
                                placeholder="Name"
                                value={formData.name}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                className={errors.name ? 'error' : ''}
                            />
                            {errors.name && <div className="error-message">{errors.name}</div>}
                        </div>

                        <div className="form-field">
                            <input
                                type="email"
                                name="email"
                                placeholder="Email"
                                value={formData.email}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                className={errors.email ? 'error' : ''}
                            />
                            {errors.email && <div className="error-message">{errors.email}</div>}
                        </div>

                        <div className="form-field">
                            <textarea
                                name="message"
                                placeholder="Message"
                                value={formData.message}
                                onChange={handleInputChange}
                                onBlur={handleInputBlur}
                                className={errors.message ? 'error' : ''}
                            />
                            {errors.message && <div className="error-message">{errors.message}</div>}
                        </div>

                        <button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Sending...' : 'Submit Now'}
                        </button>
                    </form>

                    {/* Contact Info */}
                    <div className="footer-contact-info">
                        <h2 className="footer-contact-info-title">Stay connected®</h2>
                        <a href="mailto:info@sharebite.com" className="footer-contact-email">
                            info@sharebite.com
                        </a>
                    </div>
                </div>

                {/* Scroll to Top Button */}
                <button
                    type="button"
                    title="Scroll to top"
                    className={`scroll-to-top ${showScrollTop ? 'visible' : ''}`}
                    onClick={scrollToTop}
                >
                    ↑
                </button>

                {/* Footer Bottom */}
                <div className="footer-bottom">
                    <div className="footer-links-section">
                        <div className="footer-links">
                            <h3 className="footer-links-label">Quick Links</h3>
                            <Link to="/">Home</Link>
                            <button type="button" className="footer-link-btn" onClick={() => scrollToSection('how-it-works')}>How It Works</button>
                            <button type="button" className="footer-link-btn" onClick={() => scrollToSection('why-sharebite')}>Why ShareBite</button>
                            <button type="button" className="footer-link-btn" onClick={() => scrollToSection('contact')}>Contact</button>
                            <Link to="/login">Sign In</Link>
                        </div>

                        <div className="footer-social">
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">Instagram</a>
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">Facebook</a>
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="footer-copyright">
                    <p>©2026</p>
                </div>
            </div>
        </footer>
    );
};
