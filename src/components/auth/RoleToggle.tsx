import React from 'react';
import './RoleToggle.css';

export type UserRole = 'donor' | 'recipient';

interface RoleToggleProps {
    selectedRole: UserRole;
    onRoleChange: (role: UserRole) => void;
    disabled?: boolean;
}

export const RoleToggle: React.FC<RoleToggleProps> = ({
    selectedRole,
    onRoleChange,
    disabled = false,
}) => {
    const handleRoleClick = (role: UserRole) => {
        if (!disabled && role !== selectedRole) {
            onRoleChange(role);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, role: UserRole) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleRoleClick(role);
        }
    };

    return (
        <div className={`role-toggle ${disabled ? 'disabled' : ''}`}>
            <div className="role-toggle-track">
                {/* Sliding indicator */}
                <div
                    className={`role-toggle-indicator ${selectedRole === 'recipient' ? 'right' : 'left'}`}
                />

                {/* Donor option - Clean, no icon */}
                <button
                    type="button"
                    className={`role-toggle-option ${selectedRole === 'donor' ? 'active' : ''}`}
                    onClick={() => handleRoleClick('donor')}
                    onKeyDown={(e) => handleKeyDown(e, 'donor')}
                    disabled={disabled}
                    aria-pressed={selectedRole === 'donor'}
                >
                    <span className="role-toggle-label">Donor</span>
                    <span className="role-toggle-subtitle">Share surplus food</span>
                </button>

                {/* Recipient option - Clean, no icon */}
                <button
                    type="button"
                    className={`role-toggle-option ${selectedRole === 'recipient' ? 'active' : ''}`}
                    onClick={() => handleRoleClick('recipient')}
                    onKeyDown={(e) => handleKeyDown(e, 'recipient')}
                    disabled={disabled}
                    aria-pressed={selectedRole === 'recipient'}
                >
                    <span className="role-toggle-label">Recipient</span>
                    <span className="role-toggle-subtitle">Find available food</span>
                </button>
            </div>
        </div>
    );
};
