# Intelligent Onboarding Flow

**Created:** 2025-10-17  
**Last Modified:** 2025-10-17  
**Last Modified Summary:** Initial creation of intelligent onboarding documentation

## Overview

The Intelligent Onboarding Flow is a guided system that helps new users understand whether they should set up a personal Bitcoin fundraising project or create an organization for collective management.

## User Flow

### Step 1: Describe Your Needs
Users describe their project, cause, or idea in a text field. They can also select from predefined categories:
- **Charity/Non-profit** - Animal shelters, community aid, disaster relief
- **Business/Startup** - Product development, business expansion
- **Community/Event** - Meetups, conferences, group activities
- **Open Source/Tech** - Software development, research projects

### Step 2: Smart Analysis
The system analyzes the user's description using keyword matching and contextual analysis to determine:
- Whether an organization or personal project is recommended
- The confidence level of the recommendation
- The type of setup (business, charity, community, etc.)

The analysis considers:
- **Organization Indicators:** Keywords like "organization", "group", "team", "collective", "community", "we", "our", "us"
- **Personal Indicators:** Keywords like "i", "my", "me", "personal", "individual"
- **Charity Indicators:** Keywords like "charity", "non-profit", "donation", "help", "support", "shelter", "rescue"
- **Business Indicators:** Keywords like "business", "startup", "company", "product", "service", "development"
- **Community Indicators:** Keywords like "community", "members", "event", "gathering", "collaborative"
- **Description Quality:** Longer, more detailed descriptions increase confidence

### Step 3: Personalized Recommendation
Based on the analysis, users see:
- Whether they should create an **Organization** or **Personal Campaign**
- Key benefits of the recommended approach
- What they'll receive (Bitcoin wallet setup, fundraising page, transparency dashboard)

#### Organization Setup Benefits
- Multiple people can manage funds
- Professional organization profile
- Collective decision making
- Shared treasury management
- Organization-wide transparency

#### Personal Campaign Benefits
- Simple personal fundraising
- Individual control
- Quick setup
- Personal branding
- Direct supporter connection

### Step 4: Choose Your Path
Users are presented with two options:
1. **Create Organization** - For collective projects
2. **Create Personal Campaign** - For individual projects

Additionally, they can browse existing projects to explore the platform.

## Technical Implementation

### API Endpoint

**POST /api/onboarding/analyze**

Request:
```json
{
  "description": "I run a local cat shelter and need funds for food and medical care..."
}
```

Response:
```json
{
  "isOrganization": false,
  "isPersonal": true,
  "needsCollective": false,
  "isBusiness": false,
  "isCharity": true,
  "needsFunding": true,
  "confidence": 85,
  "recommendation": "Your charitable cause can be effectively managed through a personal project...",
  "suggestedSetup": "personal"
}
```

### Components

- **IntelligentOnboarding** (`src/components/onboarding/IntelligentOnboarding.tsx`) - Main component with all four steps
- **Onboarding Page** (`src/app/(authenticated)/onboarding/page.tsx`) - Page wrapper
- **Organization Create Page** (`src/app/(authenticated)/organizations/create/page.tsx`) - Dedicated org creation page

### Frontend Flow

1. User navigates to `/onboarding` (after registration)
2. Step 1: Describe needs
3. Step 2: Analyze description (calls API)
4. Step 3: Show recommendations
5. Step 4: User clicks either:
   - "Create Organization" → redirects to `/organizations/create`
   - "Create Campaign" → redirects to `/create`
   - "Browse Projects" → redirects to `/discover`

### Backend Flow for Organization Creation

**POST /api/organizations/create**

The endpoint handles:
1. User authentication validation
2. Slug generation (with uniqueness checks)
3. Organization creation in database
4. Automatic membership creation (creator as owner)
5. Permission assignment

Database tables involved:
- `organizations` - Main organization entity
- `memberships` - User memberships with roles and permissions

## User Experience Goals

✅ **Guidance** - Help users make the right choice early  
✅ **Speed** - Quick, intuitive flow with minimal form fields  
✅ **Clarity** - Clear explanation of benefits for each path  
✅ **Transparency** - Show confidence levels in recommendations  
✅ **Flexibility** - Users can override recommendations  
✅ **Education** - Learn about organization vs personal projects  

## Integration with Home Page

The home page features:
- **Primary CTA:** "🚀 Smart Setup Guide" → `/onboarding`
- **Secondary CTA:** "Create Campaign Now" → `/create`
- **Tertiary CTA:** "Browse Projects" → `/discover`

New users are encouraged to start with the Smart Setup Guide to understand their options.

## Future Enhancements

- Integration with real AI/ML for better analysis
- Learning from user choices to improve recommendations
- A/B testing different recommendation strategies
- More granular organization type suggestions
- Integration with wallet setup guidance
- Team invitation templates for organizations
- Pre-filled governance model suggestions based on org type

## Related Documentation

- [Organization Creation Guide](/docs/features/organizations.md)
- [User Authentication](/docs/security/authentication.md)
- [Database Schema](/docs/architecture/database-schema.md)
