# ShareBite Development Guide

> **Last Updated**: January 2026  
> **Version**: 1.0

This guide defines the coding standards, conventions, and best practices for the ShareBite project.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Naming Conventions](#naming-conventions)
3. [Component Development](#component-development)
4. [State Management](#state-management)
5. [API and Services](#api-and-services)
6. [Styling Guidelines](#styling-guidelines)
7. [TypeScript Best Practices](#typescript-best-practices)
8. [Git Workflow](#git-workflow)
9. [Testing Standards](#testing-standards)

---

## Project Structure

```
src/
├── assets/              # Static assets (images, fonts, icons)
├── components/          # Reusable UI components
│   ├── common/         # Generic components (Button, Input, Card, Modal)
│   ├── layout/         # Layout components (Header, Footer, Sidebar)
│   └── features/       # Feature-specific components
│       ├── auth/       # Login, Register forms
│       ├── donor/      # Donor-specific components
│       ├── recipient/  # Recipient-specific components
│       └── listings/   # Food listing components
├── pages/              # Page components (one per route)
├── contexts/           # React Context providers
├── services/           # API service layer
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
├── styles/             # Global styles and CSS modules
└── router/             # Routing configuration
```

### File Organization Rules

- **Components** in `/components` must be reusable across pages
- **Pages** in `/pages` should be route handlers only, minimal logic
- **Business logic** belongs in services, not components
- **One component per file** - no multiple exports of components
- **Barrel exports** (index.ts) are allowed for cleaner imports

---

## Naming Conventions

### Files

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `UserProfile.tsx` |
| Utilities | camelCase | `formatDate.ts` |
| Services | camelCase | `authService.ts` |
| Types | lowercase + `.types.ts` | `user.types.ts` |
| CSS Modules | Match component name | `UserProfile.css` |
| Pages | PascalCase + `Page` suffix | `DonorDashboard.tsx` |

### Code

```typescript
// ✅ Good
export interface UserProfileProps { ... }
export const UserProfile: React.FC<UserProfileProps> = ({ ... }) => { ... }

// ❌ Bad
export interface Props { ... }
export const userProfile = ({ ... }) => { ... }
```

**Rules:**
- **Interfaces**: `ComponentNameProps` for component props
- **Functions**: camelCase (`getUserById`, `calculateDistance`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_FILE_SIZE`)
- **Enums**: PascalCase for name, UPPER_CASE for values

```typescript
export enum UserRole {
  DONOR = 'donor',
  RECIPIENT = 'recipient',
}
```

---

## Component Development

### Component Structure

```typescript
import React from 'react';
import './ComponentName.css';
// Other imports...

export interface ComponentNameProps {
  // Props definition
}

export const ComponentName: React.FC<ComponentNameProps> = ({
  prop1,
  prop2,
}) => {
  // Hooks
  // Event handlers
  // Render logic

  return (
    <div className="component-name">
      {/* JSX */}
    </div>
  );
};
```

### Component Standards

1. **Always use functional components** with hooks
2. **TypeScript required** - define props interface
3. **Export component and its props** interface
4. **Use CSS files** (not inline styles or css-in-js)
5. **Destructure props** in function signature

### Props Interface

```typescript
// ✅ Good - Clear, explicit types
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}

// ❌ Bad - Vague, uses 'any'
interface Props {
  data: any;
  callback: Function;
}
```

---

## State Management

### Context Pattern

```typescript
// 1. Create context with undefined default
const MyContext = createContext<MyContextType | undefined>(undefined);

// 2. Provider component
export const MyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<MyState>(initialState);

  const value: MyContextType = {
    state,
    // ... methods
  };

  return <MyContext.Provider value={value}>{children}</MyContext.Provider>;
};

// 3. Custom hook
export const useMyContext = (): MyContextType => {
  const context = useContext(MyContext);
  if (!context) {
    throw new Error('useMyContext must be used within MyProvider');
  }
  return context;
};
```

### State Rules

- **Use `useState`** for local component state
- **Use Context** for shared state across components
- **Keep state minimal** - derive values when possible
- **Never mutate state directly** - always use setter functions

---

## API and Services

### Service Layer Pattern

All API calls go through the service layer in `/src/services/`.

```typescript
// services/listingService.ts
import { supabase, apiRequest } from './api';
import type { FoodListing, ApiResponse } from '@types/index';

export const listingService = {
  getAll: async (): Promise<ApiResponse<FoodListing[]>> => {
    return apiRequest(async () => {
      const { data, error } = await supabase.from('listings').select('*');
      if (error) throw error;
      return data;
    });
  },
};
```

### Service Standards

1. **All services export an object** with methods
2. **Use `apiRequest` wrapper** for error handling
3. **Return `ApiResponse<T>`** for consistency
4. **Never call Supabase directly from components**

### API Response Handling

```typescript
// ✅ Good - Handles success and error cases
const response = await listingService.getAll();
if (response.success && response.data) {
  setListings(response.data);
} else {
  setError(response.error || 'Failed to load listings');
}

// ❌ Bad - No error handling
const data = await listingService.getAll();
setListings(data);
```

---

## Styling Guidelines

### CSS Organization

- **Global styles**: `src/styles/global.css` (variables, resets)
- **Component styles**: Co-located with component (`Button.css` next to `Button.tsx`)
- **Use CSS variables** from `global.css` for consistency

### CSS Naming

```css
/* ✅ Good - BEM-like, semantic */
.card {
  /* base styles */
}

.card-header {
  /* element */
}

.card--highlighted {
  /* modifier */
}

/* ❌ Bad - Generic, unclear */
.wrapper {
  /* ... */
}

.box1 {
  /* ... */
}
```

### Styling Rules

1. **No inline styles** - use className
2. **Use CSS variables** for colors, spacing
3. **Mobile-first** responsive design
4. **Consistent spacing** - use variables

```css
/* Using CSS variables */
.button {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  border-radius: var(--radius-md);
}
```

---

## TypeScript Best Practices

### Type Definitions

```typescript
// ✅ Good - Explicit, clear types
export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export type UserRole = 'donor' | 'recipient' | 'charity';

// ❌ Bad - Using 'any'
export interface User {
  data: any;
  metadata: any;
}
```

### Type vs Interface

- **Use `interface`** for object shapes
- **Use `type`** for unions, intersections, primitives

```typescript
// Interface for objects
export interface  FoodListing {
  id: string;
  title: string;
  // ...
}

// Type for unions
export type Status = 'available' | 'claimed' | 'expired';
```

### Avoid `any`

```typescript
// ✅ Good - Proper typing
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

// ❌ Bad - Using 'any'
const handleChange = (e: any) => {
  setValue(e.target.value);
}
```

---

## Git Workflow

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
```
feat(auth): add login form validation
fix(listing): resolve expiry time calculation bug
docs(readme): update setup instructions
style(button): improve hover animation
refactor(api): reorganize service layer
```

### Branch Strategy

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/feature-name` - New features
- `fix/bug-name` - Bug fixes

### Commit Guidelines

1. **Commit frequently** - small, logical changes
2. **Write clear messages** - explain "why", not "what"
3. **One concern per commit** - don't mix features and fixes

---

## Testing Standards

*To be implemented in future phases*

### Testing Principles

1. **Test user behavior**, not implementation details
2. **Write tests for critical paths** first
3. **Mock external dependencies** (API calls, etc.)

### Testing Pyramid

- **Unit Tests**: Utilities, helpers, pure functions
- **Component Tests**: Component rendering and interactions
- **Integration Tests**: Feature flows
- **E2E Tests**: Critical user journeys

---

## Path Aliases

Use configured path aliases for cleaner imports:

```typescript
// ✅ Good - Using aliases
import { Button } from '@components/common/Button';
import { authService } from '@services/authService';
import type { User } from '@types/index';

// ❌ Bad - Relative paths
import { Button } from '../../components/common/Button';
import { authService } from '../../../services/authService';
```

**Available aliases:**
- `@/` → `src/`
- `@components/` → `src/components/`
- `@pages/` → `src/pages/`
- `@services/` → `src/services/`
- `@hooks/` → `src/hooks/`
- `@contexts/` → `src/contexts/`
- `@types/` → `src/types/`
- `@utils/` → `src/utils/`
- `@styles/` → `src/styles/`
- `@assets/` → `src/assets/`

---

## Import Order Convention

Organize imports in this order:

```typescript
// 1. React and external libraries
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// 2. Internal components
import { Button } from '@components/common/Button';
import { MainLayout } from '@components/layout/MainLayout';

// 3. Services and hooks
import { authService } from '@services/authService';
import { useAuth } from '@hooks/index';

// 4. Types
import type { User, FoodListing } from '@types/index';

// 5. Styles
import './ComponentName.css';
```

---

## Code Review Checklist

Before submitting code for review:

- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Component has proper TypeScript types
- [ ] No `any` types used
- [ ] CSS uses variables instead of hardcoded values
- [ ] Path aliases used for imports
- [ ] Commit messages follow convention
- [ ] Code is well-commented where necessary

---

## Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Deployment Docs](https://vercel.com/docs)

---

**Questions?** Contact the project maintainer or open an issue in the repository.
