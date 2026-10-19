---
created_date: 2024-03-19
last_modified_date: 2025-06-12
last_modified_summary: Added documentation standards including creation and modification dates
---

# 🏗️ Architecture Overview

## Backend Technology Evolution

### Previous Architecture (Flask + SQLite)

#### Why We Started With Flask

- **Initial Benefits**:
  - Python's simplicity and readability
  - Large ecosystem of libraries
  - Good for rapid prototyping
  - Familiar to many developers

#### Challenges We Faced

1. **Database Management**:
   - SQLite file locking issues
   - Difficult to scale
   - Manual backup requirements
   - Local file system dependencies

2. **Deployment Complexity**:
   - Separate server management
   - More infrastructure to maintain
   - Complex scaling requirements
   - Higher operational costs

3. **Development Workflow**:
   - Context switching between frontend/backend
   - Different languages (Python/JavaScript)
   - Separate deployment pipelines
   - More complex local development setup

### Current Architecture (Next.js + Supabase)

#### Why We Chose Next.js API Routes

1. **Unified Codebase**:
   - Single language (TypeScript)
   - Shared types and utilities
   - Consistent development experience
   - Easier code maintenance

2. **Serverless Benefits**:
   - Automatic scaling
   - Pay-per-use pricing
   - No server management
   - Built-in CDN

3. **Development Experience**:
   - Hot reloading
   - TypeScript support
   - Built-in testing
   - Better error handling

#### Why We Chose Supabase

1. **Database Features**:
   - PostgreSQL under the hood
   - Real-time subscriptions
   - Row-level security
   - Automatic backups

2. **Authentication**:
   - Built-in auth system
   - Social login support
   - Secure session management
   - JWT support

   Our application utilizes Supabase Auth for user sign-up, login, and session management. Custom user profile data, extending beyond the basic `auth.users` table, is stored in a dedicated `public.profiles` table. Client-side state is managed by Zustand, and route protection is handled by Next.js middleware and client-side hooks. For a comprehensive guide on the authentication flow, profile management, database interactions (including `profiles` table schema and RLS), and the cascading delete setup for user profiles, please refer to the [Authentication System Detailed Guide](../security/auth_system.md).

3. **Storage**:
   - File storage with CDN
   - Image optimization
   - Secure file access
   - Easy integration

## Technology Comparison

### Backend Frameworks

```markdown
Feature Flask Next.js API Routes

---

Language Python TypeScript
Deployment Server Required Serverless
Scaling Manual Automatic
Cold Start None Possible
Development Separate Integrated
Type Safety Optional Built-in
Testing External Built-in
```

### Database Solutions

```markdown
Feature SQLite Supabase

---

Scalability Limited Excellent
Backups Manual Automatic
Real-time No Yes
Security Basic Advanced
Management File-based Cloud-based
Cost Free Usage-based
```

## Migration Process

### Phase 1: Assessment

1. Identify Flask endpoints
2. Map to Next.js API routes
3. Plan database migration
4. Create migration scripts

### Phase 2: Implementation

1. Create Next.js API routes
2. Set up Supabase project
3. Migrate data
4. Update frontend

### Phase 3: Testing

1. Unit tests
2. Integration tests
3. Performance testing
4. Security audit

### Phase 4: Deployment

1. Staging environment
2. Production deployment
3. Monitoring setup
4. Backup verification

## Security Considerations

### Flask Security

- File system access
- Database file permissions
- Server hardening
- Manual SSL setup

### Next.js + Supabase Security

- Automatic HTTPS
- Row-level security
- JWT validation
- Built-in auth

## Performance Comparison

### Flask Performance

- Server-based
- Manual scaling
- File I/O dependent
- Connection pooling required

### Next.js Performance

- Serverless
- Automatic scaling
- CDN caching
- Edge functions

## Cost Analysis

### Flask Costs

- Server hosting
- Database management
- SSL certificates
- Backup solutions

### Next.js + Supabase Costs

- Usage-based pricing
- Included SSL
- Automatic backups
- Built-in CDN

## Future Considerations

1. **Scaling**:
   - Automatic with Next.js
   - Global edge network
   - No server management

2. **Maintenance**:
   - Less infrastructure
   - Automated updates
   - Built-in monitoring

3. **Development**:
   - Faster iterations
   - Better tooling
   - Improved debugging

## Cleanup Script

For cleaning up the old Flask installation:

```bash
#!/bin/bash

# Stop any running Python processes
pkill -f "python.*flask"

# Wait for processes to stop
sleep 2

# Remove SQLite lock files
find flask_app -name "*.db-*" -delete

# Remove the directory
rm -rf flask_app

# Verify cleanup
if [ ! -d "flask_app" ]; then
    echo "Flask app directory removed successfully"
else
    echo "Warning: Flask app directory still exists"
fi
```

## Lessons Learned

1. **Start with the Right Architecture**:
   - Consider future scaling needs
   - Evaluate maintenance costs
   - Plan for team growth
   - Think about security early

2. **Database Choices Matter**:
   - File-based databases have limitations
   - Cloud databases offer more features
   - Consider backup requirements
   - Plan for data growth

3. **Development Experience**:
   - Unified codebase is better
   - Type safety is important
   - Good tooling saves time
   - Documentation is crucial

## Next Steps

1. Complete migration to Next.js
2. Set up Supabase project
3. Migrate existing data
4. Update documentation
5. Train team members

### Removed Components

- Flask App: Removed as it was not being used and we're focusing on Next.js API routes
- Screen Recorder: Planned for future implementation to enhance transparency
