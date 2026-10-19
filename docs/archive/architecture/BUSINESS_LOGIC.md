# OrangeCat Business Logic Documentation

**Created:** 2025-11-03  
**Last Modified:** 2025-11-03  
**Last Modified Summary:** Initial comprehensive documentation of business logic and implementation

---

## Executive Summary

OrangeCat is a Bitcoin-native crowdfunding platform that enables users to create fundraising projects and receive Bitcoin donations with full transparency. The business logic is implemented through a service-oriented architecture with clear separation between data access, validation, and business rules.

### Core Business Model

- **Users (Profiles)** create fundraising **Projects**
- **Transactions** track Bitcoin payments between any entities (profile ↔ profile, profile ↔ project)
- **Transparency** is built-in: all transactions are public by default
- **Bitcoin-Native**: All amounts in SATS/BTC, Lightning Network support

---

## Business Domains

### 1. **User Management (Profiles)**

#### Business Rules

**Profile Creation**

- Profile is automatically created when user registers (via database trigger `handle_new_user`)
- Username is optional but must be unique if provided
- Default username generated from email or UUID if not set
- Profile status defaults to `'active'`

**Profile Validation Rules** (`src/lib/validation.ts`)

- Username: 3-30 chars, alphanumeric + underscore/hyphen only
- Name: max 100 characters
- Bio: max 500 characters
- Bitcoin address: validated with regex `/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,}$/`
- Lightning address: validated as email format `user@domain.com`
- Website: auto-prepends `https://` if protocol missing

**Profile Service Architecture** (`src/services/profile/`)

- **Modular design**: Separated into reader/writer/mapper modules
- **ProfileReader**: All read operations (get, search, list)
- **ProfileWriter**: All write operations (create, update, delete)
- **ProfileMapper**: Database schema mapping logic
- **Single Responsibility Principle**: Each module < 200 lines

**Profile Permissions**

- Users can only edit their own profile (`auth.uid() = id`)
- Public read access for all profiles
- Row Level Security (RLS) enforces these rules at database level

---

### 2. **Project Management**

#### Business Rules

**Project Creation** (`src/app/api/projects/route.ts`)

**Validation** (`src/lib/validation.ts`):

- Title: 1-100 characters (required)
- Description: 1-2000 characters (required)
- Goal amount: Optional, positive integer if provided
- Currency: Enum `['CHF', 'USD', 'EUR', 'BTC', 'SATS']`, defaults to `'SATS'`
- Bitcoin address: Validated with regex if provided
- Lightning address: Validated as email format if provided
- Tags: Array of strings, optional

**Creation Process**:

1. User must be authenticated (checked via `supabase.auth.getUser()`)
2. Rate limiting applied (100 requests per 15 minutes)
3. Data validated with Zod schema (`projectSchema`)
4. Project inserted with `status: 'active'` by default
5. All fields optional except `title`, `description`, `user_id`

**Project Status Lifecycle**:

- `'draft'`: Incomplete projects (not visible publicly)
- `'active'`: Live projects accepting donations (visible in search/discover)
- `'completed'`: Finished projects (still visible)
- `'cancelled'`: Cancelled projects

**Project Permissions**:

- Only creator can update/delete (`auth.uid() = creator_id`)
- Public read access for all projects
- RLS policies enforce permissions
- Search only shows `status = 'active'` projects

**Project Store** (`src/stores/projectStore.ts`):

- Zustand store for client-side project state
- Computed properties: `drafts`, `activeProjects`
- Actions: `loadProjects()`, `deleteProject()`, `getProjectById()`

---

### 3. **Transaction Management**

#### Business Rules

**Transaction Creation** (`src/app/api/transactions/route.ts`)

**Validation** (`src/lib/validation.ts`):

- `amount_sats`: Positive integer, max 1,000,000,000,000 (1 trillion sats = ~1M BTC)
- `from_entity_type`: Enum `['profile', 'project']`
- `to_entity_type`: Enum `['profile', 'project']`
- `payment_method`: Enum `['bitcoin', 'lightning', 'on-chain', 'off-chain']`
- `message`: Optional, max 500 characters
- `purpose`: Optional string (e.g., "funding", "tip", "grant")
- `anonymous`: Boolean, defaults to `false`
- `public_visibility`: Boolean, defaults to `true`

**Permission Checking**:

1. User must be authenticated
2. For `from_entity_type = 'profile'`: Must be user's own profile
3. For `from_entity_type = 'project'`: Must be project creator
4. Permission check happens before transaction creation

**Transaction Status Lifecycle**:

- `'pending'`: Initial state when created
- `'processing'`: Being processed by payment system
- `'confirmed'`: Payment confirmed on blockchain/Lightning
- `'completed'`: Fully settled
- `'failed'`: Payment failed
- `'cancelled'`: Transaction cancelled

**Transaction Features**:

- **Multi-Entity Support**: Any entity can send to any other entity
- **Transparency**: `public_visibility` controls visibility
- **Anonymity**: `anonymous` flag hides sender identity
- **Audit Trail**: JSONB field for detailed transaction history
- **Verification**: Status field for payment verification

**Transaction Schema** (`supabase/migrations/`):

```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY,
  amount_sats BIGINT NOT NULL CHECK (amount_sats > 0),
  currency TEXT DEFAULT 'SATS',
  from_entity_type TEXT NOT NULL,
  from_entity_id uuid NOT NULL,
  to_entity_type TEXT NOT NULL,
  to_entity_id uuid NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  public_visibility BOOLEAN DEFAULT TRUE,
  anonymous BOOLEAN DEFAULT FALSE,
  -- ... timestamps and metadata
);
```

---

### 4. **Search & Discovery**

#### Business Rules

**Search Service** (`src/services/search.ts`)

**Search Types**:

- `'all'`: Search both profiles and projects
- `'profiles'`: Search profiles only
- `'projects'`: Search projects only

**Sort Options**:

- `'relevance'`: Score-based (title/username match > description/bio match)
- `'recent'`: Sort by `created_at DESC`
- `'popular'`: Currently falls back to `'recent'` (no contributor_count yet)
- `'funding'`: Currently falls back to `'recent'` (no total_funding yet)

**Relevance Scoring**:

- Exact username match: +100 points
- Partial username match: +50 points
- Exact title match: +100 points
- Partial title match: +60 points
- Description/bio match: +20-30 points
- Profile with avatar: +5 points (more complete)
- Project with goal: +5 points
- Project with raised funds: +10 points

**Search Filters**:

- `categories`: Filter by category (array)
- `isActive`: Filter by active status
- `hasGoal`: Only projects with goals
- `minFunding`/`maxFunding`: Funding amount range
- `dateRange`: Creation date range
- Geographic filters (schema ready, not implemented yet)

**Performance Optimizations**:

- **Caching**: 5-minute cache with LRU eviction
- **Parallel Queries**: Use `Promise.all()` for combined searches
- **Indexed Queries**: Proper database indexes on searchable fields
- **Minimal Columns**: Only fetch needed fields

**Query Implementation**:

- Uses Supabase `.or()` for ILIKE pattern matching
- Sanitizes user input (escapes SQL wildcards)
- Limits results with `.range(offset, offset + limit - 1)`
- Only searches `status = 'active'` projects

---

### 5. **Bitcoin Integration**

#### Business Rules

**Bitcoin Service** (address validation: `src/types/wallet.ts`; the old `src/services/bitcoin/index.ts` was removed)

**Address Validation**:

- Regex validation: `/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,87}$/`
- Supports Bech32 (bc1) and Legacy (1, 3) addresses
- Address cleaning: Trims whitespace, validates format

**Wallet Data Fetching**:

- **Multi-Provider Support**: Mempool.space and Blockstream with failover
- **Timeout Protection**: 10-second timeout per API call
- **Error Handling**: Tries next provider on failure
- **Balance Calculation**: Converts from API format to satoshis

**Transaction Fetching**:

- Fetches transaction history for addresses
- Normalizes transaction format across providers
- Maps provider-specific fields to unified `BitcoinTransaction` type

**Provider Abstraction**:

- Class-based architecture with dependency injection
- Singleton pattern for service instance
- Provider configuration defines endpoints and processing logic

---

### 6. **Analytics & Metrics**

#### Business Rules

**Analytics Service** (`src/services/analytics/index.ts`)

**Fundraising Metrics**:

- `totalProjects`: Count of user's projects
- `totalRaised`: Sum of all raised amounts
- `totalSupporters`: Count of unique contributors
- `activeProjects`: Count of active projects
- `recentDonations`: Donations in last period
- `avgDonationSize`: Average donation amount
- `successRate`: Currently 0 (not implemented in MVP)

**Data Sources**:

- `'database'`: Real data from Supabase
- `'api'`: External API data (Bitcoin wallet data)
- `'demo'`: Demo/placeholder data for unimplemented features

**Caching Strategy**:

- 5-minute TTL for analytics data
- Cache key based on user ID and feature
- Automatic cache cleanup on expiration

**Feature Flags**:

- `fundraising`: Enabled
- `organizations`: Disabled (not in MVP)
- `events`: Disabled
- `projects`: Enabled
- `wallet`: Enabled

**Error Handling**:

- Graceful degradation: Returns fallback metrics on error
- Logging: All errors logged with context
- Confidence levels: `'high'`, `'medium'`, `'low'` for data reliability

---

### 7. **Security & Validation**

#### Business Rules

**Input Sanitization** (`src/services/security/security-hardening.ts`):

- XSS prevention: HTML entity encoding
- Text sanitization: Removes malicious characters
- Email validation: RFC-compliant format
- Bitcoin address validation: Format + regex

**Rate Limiting** (`src/lib/rate-limit.ts`):

- **API Requests**: 100 requests per 15 minutes
- **Auth Attempts**: 5 attempts per 15 minutes (account lockout)
- **Automatic Cleanup**: Old entries removed periodically

**Authentication Security** (`src/services/auth-security.ts`):

- **Account Lockout**: 5 failed attempts = 15-minute lock
- **Password Validation**: Strength requirements
- **Secure Tokens**: Cryptographically secure token generation
- **Session Management**: Secure session storage

**Error Handling Security**:

- **Information Disclosure Prevention**: Stack traces hidden in production
- **Error Message Sanitization**: User-friendly messages, no sensitive data
- **Logging**: Security events logged with severity levels

**Content Security Policy**:

- CSP headers configured
- XSS protection enabled
- Frame protection (X-Frame-Options)
- HSTS configuration

**API Security Middleware**:

- Method validation (only allowed HTTP methods)
- Rate limit integration
- Activity logging
- Request sanitization

---

### 8. **Transparency Features**

#### Business Rules

**Transparency Service** (`src/services/transparency.ts`)

**Transparency Score Calculation**:

- Based on 12 boolean transparency indicators:
  1. Open source code
  2. Contribution guidelines
  3. Issue tracking
  4. Mission statement
  5. KPIs defined
  6. Progress updates
  7. Transaction history
  8. Transaction comments
  9. Financial reports
  10. Public channels
  11. Community updates
  12. Responsive to feedback

- Score = (True indicators / Total indicators) \* 100
- Returns 0-1 decimal score

**Default Transparency**:

- All transactions `public_visibility = true` by default
- Users can opt-in to private transactions
- Transaction audit trails stored in JSONB

---

## Data Flow & Workflows

### Project Creation Workflow

```
1. User fills CreateCampaignForm
   ↓
2. Form validates input (client-side)
   ↓
3. POST /api/projects
   ↓
4. Rate limit check → Auth check → Zod validation
   ↓
5. Insert into `projects` table
   ↓
6. RLS policies verify user_id = auth.uid()
   ↓
7. Return created project
   ↓
8. Redirect to /projects/[id] (unified route)
```

### Transaction Creation Workflow

```
1. User initiates donation
   ↓
2. POST /api/transactions
   ↓
3. Auth check → Permission check (user owns from_entity)
   ↓
4. Zod validation (amount, entities, payment_method)
   ↓
5. Insert into `transactions` table (status: 'pending')
   ↓
6. RLS policies verify permissions
   ↓
7. Return transaction ID
   ↓
8. Update project raised_amount (if to_entity is project)
```

### Search Workflow

```
1. User enters search query
   ↓
2. Check cache (5-minute TTL)
   ↓
3. If cache miss:
   - Build Supabase query with filters
   - Execute parallel queries (profiles + projects)
   - Calculate relevance scores
   - Sort by selected option
   ↓
4. Store in cache
   ↓
5. Return paginated results
```

---

## State Management

### Zustand Stores

**Auth Store** (`src/stores/auth.ts`):

- **State**: `user`, `session`, `profile`, `isLoading`, `error`
- **Actions**: `signIn()`, `signUp()`, `signOut()`, `fetchProfile()`, `updateProfile()`
- **Persistence**: SessionStorage with selective persistence (user, session, profile only)
- **Hydration**: Waits for hydration before allowing access

**Project Store** (`src/stores/projectStore.ts`):

- **State**: `projects[]`, `isLoading`, `error`
- **Computed**: `drafts`, `activeProjects`
- **Actions**: `loadProjects()`, `deleteProject()`, `getProjectById()`, `getStats()`

---

## Database Schema & Constraints

### Core Tables

**profiles**:

- Primary key: `id` (references `auth.users.id`)
- Unique constraint: `username`
- Status: `'active'` | `'suspended'` | `'deleted'`
- Bitcoin fields: `bitcoin_address`, `lightning_address`

**projects**:

- Primary key: `id` (UUID)
- Foreign key: `user_id` → `auth.users.id`
- Status: `'draft'` | `'active'` | `'completed'` | `'cancelled'`
- Funding: `goal_amount`, `raised_amount`, `currency`
- Bitcoin fields: `bitcoin_address`, `lightning_address`

**transactions**:

- Primary key: `id` (UUID)
- Amount: `amount_sats` (BIGINT, must be > 0)
- Entities: `from_entity_type`, `from_entity_id`, `to_entity_type`, `to_entity_id`
- Status: `'pending'` | `'processing'` | `'confirmed'` | `'completed'` | `'failed'` | `'cancelled'`
- Transparency: `public_visibility`, `anonymous`, `audit_trail`

### Row Level Security (RLS)

**Profiles**:

- SELECT: Public (everyone can read)
- INSERT: Users can only create their own profile (`auth.uid() = id`)
- UPDATE: Users can only update their own profile
- DELETE: Users can only delete their own profile

**Projects**:

- SELECT: Public (everyone can read)
- INSERT: Users can only create projects where `auth.uid() = creator_id`
- UPDATE: Users can only update their own projects
- DELETE: Users can only delete their own projects

**Transactions**:

- SELECT: Users can view transactions where they are sender or receiver
- INSERT: Users can create transactions where `auth.uid() = from_entity_id` (when from_entity_type = 'profile')

### Indexes

**Performance Indexes**:

- `idx_profiles_username`: Unique index on username
- `idx_projects_user_id`: Foreign key index
- `idx_projects_status`: Filter by status
- `idx_transactions_from`: Composite index on `(from_entity_id, from_entity_type)`
- `idx_transactions_to`: Composite index on `(to_entity_id, to_entity_type)`
- `idx_transactions_status`: Filter by status

---

## API Endpoints

### Projects API (`/api/projects`)

**GET /api/projects**:

- Returns active projects with pagination
- Includes profile data for each project creator
- Rate limited (100 requests / 15 min)

**POST /api/projects**:

- Creates new project
- Requires authentication
- Validates with Zod schema
- Stricter rate limiting for POST

### Transactions API (`/api/transactions`)

**POST /api/transactions**:

- Creates new transaction
- Requires authentication + permission check
- Validates with Zod schema
- Sets `status = 'pending'` by default

---

## Validation Rules Summary

### Profile Validation

- Username: 3-30 chars, `[a-zA-Z0-9_-]+`
- Name: max 100 chars
- Bio: max 500 chars
- Bitcoin address: `/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,}$/`
- Lightning address: Email format

### Project Validation

- Title: 1-100 chars (required)
- Description: 1-2000 chars (required)
- Goal amount: Optional, positive integer
- Currency: Enum `['CHF', 'USD', 'EUR', 'BTC', 'SATS']`

### Transaction Validation

- Amount: Positive integer, max 1 trillion sats
- Entity types: Enum `['profile', 'project']`
- Payment method: Enum `['bitcoin', 'lightning', 'on-chain', 'off-chain']`
- Message: Max 500 chars (optional)

---

## Error Handling

### Standard Error Responses (`src/lib/api/standardResponse.ts`)

**Success Response**:

```typescript
{ success: true, data: {...} }
```

**Error Responses**:

- `apiUnauthorized()`: 401 Unauthorized
- `apiValidationError()`: 400 Bad Request (Zod validation errors)
- `apiInternalError()`: 500 Internal Server Error
- `handleApiError()`: Generic error handler with logging

### Error Handling Strategy

- **Client-Side**: Try/catch with user-friendly messages
- **Server-Side**: Standardized error responses with status codes
- **Logging**: All errors logged with context (`logger.error()`)
- **User-Facing**: Sanitized messages, no sensitive data exposed

---

## Performance Optimizations

### Caching Strategy

- **Search Cache**: 5-minute TTL, LRU eviction
- **Analytics Cache**: 5-minute TTL per user
- **Facets Cache**: 10-minute TTL (category counts)

### Database Optimizations

- **Indexes**: Strategic indexes on foreign keys, status, searchable fields
- **Query Optimization**: Minimal column selection, parallel queries
- **Pagination**: Limit + offset for all list queries

### Code Optimizations

- **Tree Shaking**: Modular imports
- **Code Splitting**: Lazy loading of components
- **Bundle Optimization**: SWC minification, compression

---

## Testing & Quality Assurance

### Test Coverage

- **ProfileService**: 23/23 tests passing (100%)
- **Overall**: 82.9% success rate (812/982 tests)
- **Security Tests**: 38 tests (34 passing)

### Test Structure

- **Unit Tests**: Service-level logic
- **Integration Tests**: API endpoints
- **E2E Tests**: Critical user flows (Cypress)

---

## Future Enhancements (Not in MVP)

### Not Currently Implemented

- **Organizations**: Multi-user group entities (removed in MVP simplification)
- **Events**: Event management
- **Assets**: Asset management
- **People**: Social networking features

### Architecture Notes

- Schema designed to support future organization features
- Transaction system supports multi-entity payments (ready for orgs)
- RLS policies structured to support organization permissions

---

## Conclusion

OrangeCat's business logic is implemented through a **service-oriented architecture** with:

1. **Clear Separation of Concerns**: Services handle business logic, stores manage state, API routes handle HTTP
2. **Robust Validation**: Zod schemas enforce data integrity at API boundaries
3. **Security First**: RLS policies, rate limiting, input sanitization
4. **Bitcoin-Native**: All financial logic uses SATS/BTC, Lightning support
5. **Transparency by Default**: Public transactions, audit trails, verification status

The codebase follows **best practices**:

- Single Responsibility Principle (modular services)
- DRY (reusable validation, error handling)
- Type Safety (comprehensive TypeScript types)
- Performance (caching, indexing, query optimization)

---

**Document Status**: ✅ Complete - Comprehensive overview of business logic and implementation
