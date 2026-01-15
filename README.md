# ShareBite

> **A surplus food redistribution platform** connecting restaurants and cafés with local charities and individuals in need.

---

## 📋 Project Overview

ShareBite addresses food waste and food insecurity by enabling real-time connections between food donors (restaurants, cafés) and recipients (charities, individuals). Using geolocation-based matching and automated notifications, the platform ensures surplus food reaches those who need it before it expires.

### Key Features

- 🍽️ **Donor Management**: Restaurants list surplus food with expiry times
- 📍 **Geolocation Matching**: Proximity-based recipient notifications
- 🤝 **Recipient Access**: Charities and individuals can browse and claim food
- ⏱️ **Real-Time Updates**: Instant notifications when food becomes available
- 📊 **Analytics**: Track redistribution impact and activity

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

### Installation

```bash
# Navigate to project directory
cd d:\ShareBiteNew

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

---

## 📁 Project Structure

```
src/
├── assets/              # Static assets (images, fonts, icons)
├── components/          # Reusable UI components
│   ├── common/         # Button, Input, Card, Modal
│   ├── layout/         # Header, Footer, MainLayout
│   └── features/       # Feature-specific components
│       ├── auth/       # Authentication forms
│       ├── donor/      # Donor-specific components
│       ├── recipient/  # Recipient components
│       └── listings/   # Food listing components
├── pages/              # Page components (route handlers)
│   ├── HomePage.tsx
│   ├── auth/          # Login, Register pages
│   ├── donor/         # Donor dashboard, create listing
│   └── recipient/     # Recipient dashboard, browse
├── contexts/           # React Context providers
│   └── AuthContext.tsx
├── services/           # API service layer
│   ├── api.ts         # Base Supabase config
│   ├── authService.ts
│   ├── listingService.ts
│   └── geolocationService.ts
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
│   ├── constants.ts
│   ├── validators.ts
│   └── formatters.ts
├── styles/             # Global styles and CSS
└── router/             # Routing configuration
```

---

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | TypeScript type checking |

---

## 🔧 Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **State Management**: React Context API
- **Styling**: CSS Modules + Modern CSS
- **Backend**: Supabase (to be integrated)
- **Deployment**: Vercel (planned)

---

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Supabase Configuration (to be set up later)
VITE_SUPABASE_URL=your-supabase-url-here
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here

# API Configuration
VITE_API_BASE_URL=http://localhost:3000

# Geolocation API (if using third-party service)
VITE_GEOLOCATION_API_KEY=your-geolocation-api-key-here
```

### Path Aliases

The project uses path aliases for cleaner imports:

```typescript
import { Button } from '@components/common/Button';
import { authService } from '@services/authService';
import type { User } from '@types/index';
```

Available aliases: `@/`, `@components/`, `@pages/`, `@services/`, `@hooks/`, `@contexts/`, `@types/`, `@utils/`, `@styles/@assets/`

---

## 📖 Development Guide

**Read [DEVELOPMENT_GUIDE.md](./DEVELOPMENT_GUIDE.md)** for comprehensive coding standards, conventions, and best practices.

### Key Principles

1. **Component-Driven**: Reusable, modular components
2. **Type-Safe**: Strict TypeScript with no `any` types
3. **Service Layer**: All API calls through dedicated services
4. **Consistent Styling**: CSS variables and modules
5. **Git Commits**: Follow conventional commit format

---

## 🔄 Development Workflow

1. **Start Development Server**: `npm run dev`
2. **Create Component**: Follow naming conventions (PascalCase)
3. **Add Types**: Define interfaces in `/types`
4. **Write Tests**: (to be implemented in future phases)
5. **Format Code**: `npm run format`
6. **Type Check**: `npm run type-check`
7. **Commit**: Use conventional commit format

---

## 🌐 Deployment (Planned)

### Vercel Deployment

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel`
4. Set environment variables in Vercel dashboard

### Supabase Integration

1. Create Supabase project
2. Set up database schema (see project documentation)
3. Configure environment variables
4. Update service layer implementations

---

## 📝 Functional Requirements

The platform implements the following core requirements:

1. ✅ Modular project structure ready
2. ✅ Type-safe component architecture
3. ✅ Service layer for API integration prepared
4. ⏳ User registration (donor/recipient/charity)
5. ⏳ Food listing creation and management
6. ⏳ Geolocation-based matching
7. ⏳ Real-time notifications
8. ⏳ Listing status tracking
9. ⏳ Analytics dashboard

---

## 🎨 Design Philosophy

- **Premium Aesthetics**: Modern gradients, smooth animations
- **Responsive**: Mobile-first design approach
- **Accessible**: WCAG compliance (to be implemented)
- **Performant**: Optimized bundle sizes and lazy loading

---

## 📚 Additional Resources

- [Implementation Plan](./implementation_plan.md)
- [Development Guide](./DEVELOPMENT_GUIDE.md)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Deployment](https://vercel.com/docs)

---

## 👥 Contributing

This is an individual academic project. For questions or suggestions, please contact the project maintainer.

---

## 📄 License

This project is developed as part of an academic submission.

---

**Project Context**: Food waste and food insecurity represent two of the most pressing challenges of contemporary global society. ShareBite leverages digital technology and location-aware services to address coordination failures within food distribution systems, enabling connections between food donors and recipients in near real time.
