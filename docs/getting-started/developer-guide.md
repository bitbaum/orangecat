# OrangeCat Developer Guide

Welcome to the OrangeCat codebase! This guide will help you understand the project structure, find what you need, and contribute effectively.

## 🚀 Quick Start

### For New Developers

1. **Read this guide** - Understand the project structure
2. **Set up your environment** - See [Environment Setup](#environment-setup)
3. **Run the project** - Use `pnpm run dev`
4. **Explore the codebase** - Start with the sections below

### For Contributors

1. **Understand the architecture** - See [Architecture](#architecture)
2. **Follow the patterns** - Check [Development Patterns](#development-patterns)
3. **Write tests** - See [Testing](#testing)
4. **Submit changes** - Follow [Contributing](#contributing)

---

## 📁 Project Structure

```
/home/g/dev/orangecat/
├── 📁 src/                          # Main application code
│   ├── 📁 app/                      # Next.js app router pages
│   │   ├── 📁 (authenticated)/      # Protected routes
│   │   │   ├── 📁 dashboard/        # Main dashboard
│   │   │   ├── 📁 profile/          # User profile pages
│   │   │   └── 📁 organizations/    # Organization pages
│   │   ├── 📁 auth/                 # Authentication pages
│   │   ├── 📁 api/                  # API routes
│   │   └── 📁 blog/                 # Blog pages
│   ├── 📁 components/               # React components
│   │   ├── 📁 ui/                   # Base UI components
│   │   ├── 📁 layout/               # Layout components
│   │   ├── 📁 profile/              # Profile-related components
│   │   ├── 📁 wallet/               # Wallet-related components
│   │   └── 📁 funding/              # Funding-related components
│   ├── 📁 services/                 # Business logic services
│   │   ├── 📁 supabase/             # Supabase integration
│   │   ├── 📁 bitcoin/              # Bitcoin utilities
│   │   └── 📁 search/               # Search functionality
│   ├── 📁 types/                   # TypeScript type definitions
│   ├── 📁 utils/                    # Utility functions
│   ├── 📁 hooks/                    # Custom React hooks
│   ├── 📁 stores/                   # State management
│   └── 📁 lib/                      # Library functions
├── 📁 content/                     # Static content
│   └── 📁 blog/                     # Blog posts (MDX)
├── 📁 docs/                        # Documentation
│   ├── 📁 architecture/             # System architecture docs
│   ├── 📁 development/              # Development guides
│   ├── 📁 security/                 # Security documentation
│   └── 📁 deployment/               # Deployment guides
├── 📁 scripts/                     # Utility scripts
│   ├── 📁 db/                       # Database scripts
│   ├── 📁 deployment/               # Deployment scripts
│   └── 📁 dev/                      # Development scripts
└── 📁 tests/                       # Test files
    ├── 📁 e2e/                      # End-to-end tests
    └── 📁 unit/                     # Unit tests
```

---

## 🔧 Environment Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** or **yarn**
- **Git**
- **Supabase CLI** (optional, for local development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd orangecat

# Install dependencies
pnpm install

# Set up environment variables
cp config/production.env.template .env.local
# Edit .env.local with your Supabase credentials

# Start development server
pnpm run dev
```

### Environment Variables

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key

**Optional:**

- `SUPABASE_SERVICE_ROLE_KEY` - For admin operations
- `SUPABASE_ACCESS_TOKEN` - For MCP tools

---

## 🏗️ Architecture Overview

### Core Technologies

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Testing**: Vitest, Playwright
- **Deployment**: Self-hosted on Hetzner (bitbaum, behind Caddy)

### Key Features

- **Bitcoin Funding Platform** - Crowdfunding with Bitcoin/Lightning
- **Profile Management** - User profiles with verification
- **Organization Support** - Multi-user organizations
- **Wallet Integration** - Bitcoin wallet discovery and management
- **Social Features** - Following, associations, networking

### Architecture Principles

- **Modular Design** - Small, focused components and services
- **Type Safety** - Comprehensive TypeScript coverage
- **Security First** - Multi-layer security validation
- **Performance Optimized** - Lazy loading and code splitting

---

## 📖 Where to Find What

### 🧩 **Components**

- **UI Components**: `src/components/ui/` - Buttons, forms, cards, etc.
- **Layout Components**: `src/components/layout/` - Header, footer, navigation
- **Feature Components**: `src/components/[feature]/` - Profile, wallet, funding, etc.

### 🔧 **Business Logic**

- **Services**: `src/services/` - Supabase integration, Bitcoin utilities, search
- **Utilities**: `src/utils/` - Validation, formatting, helpers
- **Types**: `src/types/` - TypeScript definitions

### 📄 **Pages & Routes**

- **App Pages**: `src/app/` - Next.js pages organized by feature
- **API Routes**: `src/app/api/` - Server-side API endpoints

### 🗄️ **Data & Configuration**

- **Blog Posts**: `content/blog/` - MDX blog posts
- **Dashboard Configs**: `src/config/dashboard/` - Feature configurations
- **Demo Data**: `src/data/` - Mock data for development

### 🧪 **Testing**

- **Unit Tests**: `src/__tests__/` and component-specific tests
- **E2E Tests**: `tests/e2e/` - Playwright tests
- **Integration Tests**: `src/services/__tests__/`

---

## 🚀 Development Workflow

### Creating New Features

1. **Plan the Feature**

   ```bash
   # Check existing patterns in similar features
   find src/components -name "*[feature]*" -type d
   ```

2. **Create Component Structure**

   ```bash
   mkdir -p src/components/new-feature
   # Create index.tsx, types.ts, utils.ts as needed
   ```

3. **Add to Navigation**

   ```typescript
   // Update navigation config
   // Add to appropriate dashboard config
   ```

4. **Write Tests**
   ```bash
   pnpm test new-feature
   ```

### Database Changes

1. **Create Migration**

   ```bash
   # Use Supabase migrations
   supabase migration new feature_name
   ```

2. **Update Types**

   ```typescript
   // Update src/types/database.ts
   // Update validation schemas
   ```

3. **Test Locally**
   ```bash
   pnpm run dev
   # Test the changes
   ```

### Blog Posts

1. **Create MDX File**

   ```bash
   # Use the template
   cp scripts/blog/blog-template.mdx content/blog/new-post.mdx
   ```

2. **Write Content**
   - Use the available MDX components
   - Add frontmatter with metadata
   - Use `<Alert>`, `<YouTube>`, `<CTA>` components

3. **Publish**
   ```typescript
   // Set published: true in frontmatter
   // Deploy to see live
   ```

---

## 🔒 Security & Validation

### Bitcoin Address Validation

```typescript
import { isValidBitcoinAddress } from '@/utils/validation';

// Validates format, length, and security
const result = isValidBitcoinAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
```

### Profile Security

```typescript
import { isValidUsername, isValidBio } from '@/utils/validation';

// Prevents impersonation and injection
const usernameResult = isValidUsername('elonmusk'); // Blocked
const bioResult = isValidBio('<script>alert("xss")</script>'); // Blocked
```

### Authentication

- Uses Supabase Auth with RLS policies
- JWT tokens for API access
- Protected routes for sensitive features

---

## 🧪 Testing Strategy

### Test Organization

```
tests/
├── e2e/                    # Playwright end-to-end tests
│   ├── auth/              # Authentication flows
│   ├── profile/           # Profile management
│   └── funding/           # Campaign creation
└── unit/                  # Vitest unit tests
    ├── components/        # Component tests
    ├── utils/             # Utility tests
    └── services/          # Service tests
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test suites
pnpm run test:unit          # Full fast Vitest suite (unit + smoke + env — what CI gates)
pnpm run test:auth          # Auth tests
pnpm run test:security      # Security tests

# Run with coverage
pnpm run test:ci           # CI mode with coverage
```

### Writing Tests

```typescript
// Component test example
import { render, screen } from '@testing-library/react'
import MyComponent from './MyComponent'

test('renders correctly', () => {
  render(<MyComponent />)
  expect(screen.getByText('Expected text')).toBeInTheDocument()
})
```

---

## 🚀 Deployment

### Production Deployment

```bash
# Build for production
pnpm run build:production

# Deploy: self-hosted on Hetzner (bitbaum, behind Caddy).
# See docs/operations/deployment/DEPLOYMENT_PROCESS.md for the on-box flow.
```

### Environment Variables

- **Development**: `.env.local` (gitignored)
- **Production**: `/opt/orangecat/app/.env` on the Hetzner box

### Database Migrations

```bash
# Migrations apply automatically on deploy (scripts/apply-migrations.sh)

# Generate new migration
pnpm exec supabase migration new feature_name
```

---

## 📚 Documentation Structure

### 📁 **docs/** Directory Organization

#### **Architecture** (`docs/architecture/`)

- `ARCHITECTURE.md` - High-level system overview
- `database-schema.md` - Database design and relationships
- `services-architecture.md` - Service layer design
- `TECHNICAL.md` - Technical specifications

#### **Development** (`docs/development/`)

- `BEST_PRACTICES.md` - Code standards and patterns
- `codebase-organization.md` - File structure guide
- `hooks-guide.md` - Custom hook patterns
- `types-guide.md` - TypeScript usage guide
- `utils-guide.md` - Utility function patterns

#### **Security** (`docs/security/`)

- `SECURITY.md` - Security overview and policies
- `audit-report.md` - Security audit results
- `auth_system.md` - Authentication system details
- `celebrity-impersonation-prevention.md` - Anti-impersonation measures

#### **Deployment** (`docs/deployment/`)

- `production-readiness-2025-06-08.md` - Deployment checklist
- Infrastructure and DevOps guides

#### **Features** (`docs/features/`)

- Feature-specific documentation and guides

#### **Standards** (`docs/standards/`)

- `documentation_standards.md` - Documentation guidelines
- `datetime_standards.md` - Date/time handling standards

### 📋 **Key Documentation Files**

| Topic                | File                                        | Purpose                        |
| -------------------- | ------------------------------------------- | ------------------------------ |
| **Project Overview** | `README.md`                                 | High-level project description |
| **Setup Guide**      | `docs/development/README.md`                | Getting started instructions   |
| **Architecture**     | `docs/architecture/ARCHITECTURE.md`         | System design overview         |
| **Security**         | `docs/security/SECURITY.md`                 | Security policies and measures |
| **Standards**        | `docs/standards/documentation_standards.md` | Documentation guidelines       |
| **Contributing**     | `docs/contributing/CONTRIBUTING.md`         | Contribution guidelines        |

---

## 🛠️ Common Development Tasks

### Adding a New Component

1. **Create the component file**

   ```bash
   # In src/components/feature/
   touch NewComponent.tsx
   ```

2. **Add proper TypeScript types**

   ```typescript
   interface NewComponentProps {
     // Define props
   }
   ```

3. **Follow naming conventions**
   - Use PascalCase for components
   - Use camelCase for props and functions
   - Export as default

4. **Add to index file if needed**
   ```typescript
   // src/components/feature/index.ts
   export { default as NewComponent } from './NewComponent';
   ```

### Creating API Routes

1. **Create route file**

   ```bash
   # In src/app/api/feature/
   touch route.ts
   ```

2. **Implement proper error handling**

   ```typescript
   import { handleApiError } from '@/lib/errors';
   ```

3. **Add authentication if needed**
   ```typescript
   import { withAuth } from '@/lib/api/withAuth';
   ```

### Database Changes

1. **Create migration**

   ```bash
   supabase migration new add_new_table
   ```

2. **Update TypeScript types**

   ```typescript
   // src/types/database.ts
   export interface NewTable {
     // Define new table structure
   }
   ```

3. **Update validation schemas**
   ```typescript
   // src/lib/validation.ts
   export const newTableSchema = z.object({...})
   ```

---

## 🔍 Finding Information

### **Quick Reference**

| I Need To...           | Look In...           | File/Path                           |
| ---------------------- | -------------------- | ----------------------------------- |
| **Create a component** | Component templates  | `docs/templates/component.md`       |
| **Add validation**     | Validation utilities | `src/utils/validation.ts`           |
| **Update database**    | Migrations guide     | `docs/supabase/migrations-guide.md` |
| **Add API route**      | API templates        | `docs/templates/api-endpoint.md`    |
| **Write tests**        | Testing guide        | `docs/testing/test-guide.md`        |
| **Deploy**             | Deployment docs      | `docs/deployment/`                  |
| **Security check**     | Security docs        | `docs/security/`                    |

### **Search Tips**

- Use `grep` for finding specific code patterns
- Check `docs/` for comprehensive guides
- Look in `src/types/` for TypeScript definitions
- Check `src/services/` for business logic

---

## 🎯 Best Practices

### Code Organization

- **Single Responsibility** - One file, one purpose
- **Consistent Naming** - Follow established patterns
- **Type Safety** - Use TypeScript everywhere
- **Error Handling** - Proper error boundaries and logging

### Performance

- **Lazy Loading** - Use `React.lazy()` for large components
- **Code Splitting** - Dynamic imports for routes
- **Memoization** - Use `useMemo` and `useCallback` appropriately
- **Bundle Analysis** - Run `pnpm run analyze` regularly

### Security

- **Input Validation** - Always validate user input
- **Authentication** - Use Supabase Auth properly
- **Authorization** - Check permissions for all actions
- **Data Sanitization** - Clean user data before processing

### Testing

- **Unit Tests** - Test individual functions and components
- **Integration Tests** - Test service interactions
- **E2E Tests** - Test complete user flows
- **Security Tests** - Test authentication and authorization

---

## 📞 Getting Help

### **Common Issues**

- **Build Errors**: Check TypeScript compilation with `pnpm run type-check`
- **Runtime Errors**: Check browser console and server logs
- **Database Issues**: Verify Supabase connection and migrations
- **Authentication**: Check auth configuration and RLS policies

### **Resources**

- **Project README**: `README.md` - High-level overview
- **Architecture Docs**: `docs/architecture/` - System design
- **Development Guide**: `docs/development/` - Day-to-day development
- **Security Guide**: `docs/security/` - Security policies
- **Standards**: `docs/standards/` - Coding standards

### **Community**

- **GitHub Issues** - For bugs and feature requests
- **Pull Requests** - For code contributions
- **Documentation** - Help improve these guides

---

## 🔄 Keeping This Guide Updated

This guide should evolve with the codebase. When you:

- **Add new features** → Update the architecture section
- **Change file structure** → Update the project structure section
- **Add new patterns** → Update the development workflow section
- **Find missing information** → Add it to the appropriate section

**Remember:** A good developer guide is a living document that grows with the project!

---

_Last Updated: $(date)_
_Version: 1.0.0_
