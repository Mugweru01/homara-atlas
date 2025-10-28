# Homara Gatekeeper - Admin Panel

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-production--ready-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue)
![React](https://img.shields.io/badge/React-18.3-61dafb)
![License](https://img.shields.io/badge/license-Private-red.svg)

**A modern, premium admin panel for managing property listings, users, and landlord verifications.**

[Features](#-features) • [Getting Started](#-getting-started) • [Documentation](#-documentation) • [Deployment](#-deployment)

</div>

---

## 🎯 Overview

Homara Gatekeeper is a sophisticated admin control panel designed for managing a property rental platform. It provides comprehensive tools for user management, property moderation, landlord verification, and system monitoring.

### ✨ Key Features

- **🎨 Premium UI/UX** - Modern glassmorphism design with smooth animations
- **📸 Photo Verification** - Advanced image review system for content moderation
- **👥 User Management** - Bulk operations, filtering, and comprehensive CRUD
- **🏠 Property Listings** - Full approval workflow with photo inspection
- **✅ Landlord Verifications** - Document review and verification processing
- **📊 Analytics Dashboard** - Real-time stats with trend indicators
- **📋 Audit Logging** - Complete action tracking and compliance
- **🔐 Role-Based Access** - Granular permissions (Super Admin, Senior Admin, Junior Admin)
- **📱 Fully Responsive** - Mobile, tablet, and desktop optimized
- **🌙 Dark Mode** - Refined dark theme support

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([install with nvm](https://github.com/nvm-sh/nvm))
- **npm** or **yarn**
- **Supabase account** ([sign up free](https://supabase.com))

### Installation

```bash
# Clone the repository
git clone https://github.com/Mugweru01/homara-gatekeeper.git

# Navigate to project directory
cd homara-gatekeeper

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Environment Configuration

Create a `.env.local` file in the root directory:

```env
VITE_SUPABASE_URL=your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_UPSTASH_REDIS_REST_URL=your-redis-url.upstash.io
VITE_UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

Get these values from your [Supabase Dashboard](https://app.supabase.com) → Project Settings → API.

📖 **For detailed setup instructions, see [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)**

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The application will be available at `http://localhost:5173`

---

## 🏗️ Tech Stack

### Core Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3+ | UI Framework |
| **TypeScript** | 5.2+ | Type Safety |
| **Vite** | 5.0+ | Build Tool |
| **Tailwind CSS** | 3.4+ | Styling |
| **shadcn-ui** | Latest | UI Components |
| **Supabase** | Latest | Backend & Database |
| **React Router** | 6+ | Routing |
| **Lucide React** | Latest | Icons |
| **Sonner** | Latest | Toast Notifications |

### Key Features

- **Modern Build** - Lightning-fast Vite with HMR
- **Type Safety** - Full TypeScript coverage
- **Component Library** - Customizable shadcn-ui components
- **Database** - PostgreSQL via Supabase
- **Authentication** - Supabase Auth with RLS
- **Storage** - Supabase Storage for images
- **Real-time** - Live updates via Supabase subscriptions

---

## 📚 Documentation

### User Guides

- **[Production Deployment Guide](PRODUCTION_DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[Environment Setup](ENVIRONMENT_SETUP.md)** - Environment variables configuration
- **[Photo Verification Checklist](PHOTO_VERIFICATION_CHECKLIST.md)** - Image verification system
- **[Photo Verification Flow](PHOTO_VERIFICATION_FLOW.md)** - Visual workflow guide
- **[Property Images Troubleshooting](PROPERTY_IMAGES_TROUBLESHOOTING.md)** - Debug image loading
- **[Changelog](CHANGELOG.md)** - Version history and changes

### Security Documentation

- **[Security Audit Report](SECURITY_AUDIT_REPORT.md)** - Comprehensive security audit findings
- **[Security Fixes Applied](SECURITY_FIXES_APPLIED.md)** - All security improvements implemented
- **[Environment Setup](ENVIRONMENT_SETUP.md)** - Secure environment configuration

### Feature Documentation

- **[UI/UX Redesign Complete](UI_UX_REDESIGN_COMPLETE.md)** - Complete redesign details
- **[Listings Management](LISTINGS_MANAGEMENT_REDESIGN.md)** - Property management features
- **[Users Management](USERS_MANAGEMENT_REDESIGN.md)** - User management system

---

## 🎨 Features in Detail

### Dashboard
- **Real-time Statistics** - Count-up animations for key metrics
- **Trend Indicators** - Visual up/down trends with percentages
- **Quick Actions** - Fast access to common tasks
- **Alerts** - Pending verifications and important notifications

### Users Management
- **Bulk Operations** - Verify/unverify/delete multiple users
- **Advanced Filtering** - Search by name, email, role, status
- **User Details** - Comprehensive user information modal
- **Inline Editing** - Quick user profile updates
- **Export** - CSV export of user data

### Property Listings
- **Photo Verification** - Review all property images before approval
- **Full-Screen Viewer** - Inspect images at maximum size
- **Approval Workflow** - Approve or decline with reasons
- **Bulk Actions** - Process multiple properties at once
- **Landlord Info** - View property owner details

### Verifications
- **Document Review** - View landlord verification documents
- **Trust Scores** - Landlord reliability indicators
- **Approval Process** - Accept or reject verification requests
- **Timeline** - Track verification status over time

### Audit Logs
- **Action Tracking** - All admin actions logged
- **Filtering** - Search by action type and date
- **Export** - Download audit reports
- **Compliance** - Full audit trail for regulatory requirements

### Admins Management
- **Admin Creation** - Add new admin users
- **Role Assignment** - Super, Senior, Junior admin levels
- **Status Management** - Active, Inactive, Suspended
- **Permissions** - Granular access control

---

## 🔐 Security

### Built-in Security Features

- ✅ **Password Hashing** - Bcrypt with cost factor 12 for admin codes
- ✅ **Row-Level Security (RLS)** - Database-level access control with injection protection
- ✅ **Role-Based Access Control** - Granular permissions system
- ✅ **Secure Authentication** - Supabase Auth with JWT tokens
- ✅ **Rate Limiting** - Redis-based brute-force protection
- ✅ **Audit Logging** - Complete action tracking and compliance
- ✅ **Environment Variables** - No hardcoded credentials
- ✅ **XSS Protection** - Input sanitization with Zod schemas
- ✅ **CORS Configuration** - Secure API access control
- ✅ **Dependency Security** - Regular vulnerability scanning (0 known issues)

### Security Audits

**Latest Audit:** October 28, 2025  
**Security Score:** 🟢 **92/100** (Excellent)

📋 **View Reports:**
- [Security Audit Report](SECURITY_AUDIT_REPORT.md) - Complete security assessment
- [Security Fixes Applied](SECURITY_FIXES_APPLIED.md) - All improvements implemented

### Admin Roles

| Role | Permissions |
|------|-------------|
| **Super Admin** | Full access to all features |
| **Senior Admin** | User management, property approval, verifications |
| **Junior Admin** | View-only access, limited actions |
| **Support Admin** | Customer support and help desk functions |

---

## 📦 Deployment

### Quick Deploy Options

#### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Mugweru01/homara-gatekeeper)

```bash
npm install -g vercel
vercel login
vercel --prod
```

#### Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/Mugweru01/homara-gatekeeper)

```bash
npm install -g netlify-cli
netlify login
npm run build
netlify deploy --prod --dir=dist
```

### Manual Deployment

See [PRODUCTION_DEPLOYMENT_GUIDE.md](PRODUCTION_DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm test

# E2E tests (if configured)
npm run test:e2e

# Linting
npm run lint

# Type checking
npm run type-check
```

### Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | Latest | ✅ Supported |
| Firefox | Latest | ✅ Supported |
| Safari | Latest | ✅ Supported |
| Edge | Latest | ✅ Supported |
| Mobile Safari | iOS 13+ | ✅ Supported |
| Chrome Mobile | Latest | ✅ Supported |

---

## 🤝 Contributing

This is a private project. For authorized contributors:

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

### Coding Standards

- **TypeScript** - Strict mode enabled
- **ESLint** - Airbnb config
- **Prettier** - Code formatting
- **Conventional Commits** - Commit message format

---

## 📈 Performance

### Lighthouse Scores

- **Performance**: 95+
- **Accessibility**: 98+
- **Best Practices**: 95+
- **SEO**: 90+

### Optimization Techniques

- ✅ Code splitting with React lazy loading
- ✅ Image lazy loading
- ✅ Vite production build optimization
- ✅ Tailwind CSS purge for minimal bundle
- ✅ GPU-accelerated animations
- ✅ Virtual scrolling for large lists
- ✅ Optimistic UI updates

---

## 📞 Support

### Contact

- **Email**: wachiraedwin02@gmail.com
- **Location**: Kenya
- **Organization**: Karogotos

### Resources

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn-ui Documentation](https://ui.shadcn.com)

---

## 📝 License

This project is private and proprietary. All rights reserved.

---

## 🙏 Acknowledgments

Built with:
- [React](https://react.dev) - UI Framework
- [Supabase](https://supabase.com) - Backend Platform
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [shadcn-ui](https://ui.shadcn.com) - Component Library
- [Lucide Icons](https://lucide.dev) - Icons
- [Vite](https://vitejs.dev) - Build Tool

---

## 🎯 Project Status

### Current Version: 1.0.0 - Production Ready ✅

**Last Updated**: October 26, 2025

| Feature | Status |
|---------|--------|
| UI/UX Redesign | ✅ Complete |
| Photo Verification | ✅ Complete |
| User Management | ✅ Complete |
| Property Listings | ✅ Complete |
| Verifications | ✅ Complete |
| Audit Logs | ✅ Complete |
| Admin Management | ✅ Complete |
| Settings | ✅ Complete |
| Mobile Responsive | ✅ Complete |
| Documentation | ✅ Complete |
| Production Deploy | ✅ Ready |

---

<div align="center">

**Built with ❤️ in Kenya**

[Report Bug](https://github.com/Mugweru01/homara-gatekeeper/issues) · [Request Feature](https://github.com/Mugweru01/homara-gatekeeper/issues)

</div>
