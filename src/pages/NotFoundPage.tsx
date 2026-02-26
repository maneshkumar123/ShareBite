import React from 'react';

const NotFoundPage: React.FC = () => {
    return (
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
};

export default NotFoundPage;
