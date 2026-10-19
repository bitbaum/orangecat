# 🎯 OrangeCat Long-Term Vision

**Created:** 2025-01-20  
**Last Modified:** 2025-01-20  
**Last Modified Summary:** Initial vision document capturing long-term platform evolution

---

## 🎯 Current Focus (MVP)

**Phase 1: Foundation**
- ✅ Individual Profiles
- ✅ Projects (fundraising initiatives)
- 🚧 Discover page (search and browse)
- 🚧 Bitcoin payment integration

**Goal:** Get profiles and projects working perfectly before expanding.

---

## 🌟 Long-Term Vision: Multi-Entity Platform

OrangeCat will evolve into a comprehensive platform where people can raise Bitcoin for **anything** - not just projects, but also **assets**, **events**, and **organizations**. All entities will be interconnected and shareable.

---

## 📦 Core Entities (Future)

### 1. **Profiles** ✅ (Current)
Individual users who can create projects, own assets, organize events, and join organizations.

### 2. **Projects** ✅ (Current)
Fundraising initiatives with goals, timelines, and Bitcoin addresses.

### 3. **Organizations** 🔮 (Future)
Formal groups (nonprofits, companies, DAOs) that can own projects, assets, and organize events.

### 4. **Assets/Purchases** 🔮 (Future)
**Physical or digital items** that people need funding for:
- **Physical Assets**: Equipment, tools, hardware
- **Digital Assets**: Software subscriptions (e.g., Cursor subscription), licenses, services
- **Shareable Asset Profiles**: Each asset gets its own shareable link/page

**Key Features:**
- Assets can be associated with:
  - A **project** (e.g., "OrangeCat project needs Cursor subscription")
  - An **individual** (e.g., "Mao needs Cursor subscription")
  - Both simultaneously (multi-association)
- When someone donates to an asset, it reflects on:
  - The asset's own profile/page
  - Associated project(s) profile
  - Associated individual profile(s)
- **Example Scenario:**
  ```
  Asset: "Cursor Subscription"
  Associated with:
    - Project: "OrangeCat" 
    - Profile: "Mao"
  
  When someone donates 500 CHF in BTC:
    ✅ Cursor Subscription asset page shows donation
    ✅ OrangeCat project profile reflects the contribution
    ✅ Mao's individual profile reflects the contribution
  ```

### 5. **Events** 🔮 (Future)
Time-bound gatherings or activities that need funding:
- Conferences, meetups, workshops
- Community events, festivals
- Fundraising galas

**Key Features:**
- Event profiles with dates, locations, goals
- Shareable event links
- Association with projects/organizations/individuals

---

## 🔗 Entity Associations

### Multi-Association System

**Any entity can be associated with multiple other entities:**

```
Asset "Cursor Subscription"
├── Associated with Project "OrangeCat"
└── Associated with Profile "Mao"

Event "Bitcoin Meetup Zurich"
├── Associated with Organization "Bitcoin Zurich"
└── Associated with Profile "Event Organizer"

Project "OrangeCat"
├── Owned by Profile "Mao"
└── Contains Assets: ["Cursor Subscription", "Server Hosting"]
```

### Donation Reflection

**When a donation is made to an asset/event/project:**

1. **Primary Entity** receives the donation (e.g., Asset profile)
2. **Associated Entities** reflect the contribution:
   - Project profiles show associated asset funding
   - Individual profiles show contributions to their assets/projects
   - Organization profiles aggregate member contributions

**Example Flow:**
```
Donation: 500 CHF BTC → "Cursor Subscription" asset
├── Asset profile: +500 CHF
├── OrangeCat project: Shows "Cursor Subscription funded: 500 CHF"
└── Mao's profile: Shows "Cursor Subscription funded: 500 CHF"
```

---

## 🎨 User Experience Vision

### Shareable Links

**Every entity gets a shareable profile:**

- `orangecat.ch/projects/orangecat` - Project page
- `orangecat.ch/assets/cursor-subscription` - Asset page
- `orangecat.ch/events/bitcoin-meetup-zurich` - Event page
- `orangecat.ch/organizations/bitcoin-zurich` - Organization page
- `orangecat.ch/profiles/mao` - Individual profile

### Discovery

**Users can discover:**
- Projects by category, location, funding status
- Assets by type, association, funding status
- Events by date, location, category
- Organizations by type, verification status
- People by skills, contributions, projects

### Funding Flexibility

**People can fund:**
- ✅ Projects (current)
- 🔮 Assets (future) - "Help me buy X"
- 🔮 Events (future) - "Help me throw Y"
- 🔮 Organizations (future) - "Support our mission"

---

## 🏗️ Technical Architecture (Future)

### Database Schema Evolution

**Current (MVP):**
- `profiles` ✅
- `projects` ✅

**Future Additions:**
- `assets` table
  - `id`, `name`, `description`, `type` (physical/digital/subscription)
  - `associated_project_id`, `associated_profile_id` (nullable)
  - `goal_amount`, `current_amount`
  - `bitcoin_address`, `lightning_address`
  - `status`, `created_at`, `updated_at`

- `events` table
  - `id`, `name`, `description`, `event_date`, `location`
  - `associated_organization_id`, `associated_profile_id`
  - `goal_amount`, `current_amount`
  - `bitcoin_address`, `lightning_address`
  - `status`, `created_at`, `updated_at`

- `entity_associations` table (polymorphic)
  - `id`, `entity_type` (project/asset/event/organization)
  - `entity_id`, `associated_entity_type`, `associated_entity_id`
  - `association_type` (owns, needs, organizes, etc.)
  - `created_at`

### Unified Transaction System

**All entities use the same transaction model:**
- Any entity can receive donations
- Transactions reflect on associated entities
- Unified Bitcoin/Lightning payment handling

---

## 📊 Implementation Phases

### Phase 1: Foundation ✅ (Current)
- [x] Individual profiles
- [x] Projects
- [ ] Discover/search functionality
- [ ] Bitcoin payment integration

### Phase 2: Assets 🔮 (Future)
- [ ] `assets` table schema
- [ ] Asset creation/editing UI
- [ ] Asset profile pages
- [ ] Multi-association system
- [ ] Donation reflection on associated entities

### Phase 3: Events 🔮 (Future)
- [ ] `events` table schema
- [ ] Event creation/editing UI
- [ ] Event profile pages
- [ ] Calendar integration
- [ ] Event discovery

### Phase 4: Organizations 🔮 (Future)
- [ ] Enhanced organization features
- [ ] Organization profile pages
- [ ] Member management
- [ ] Organization-owned projects/assets/events

### Phase 5: Advanced Features 🔮 (Future)
- [ ] Multi-entity associations UI
- [ ] Unified discovery across all entity types
- [ ] Advanced analytics and reporting
- [ ] Social features (following, notifications)

---

## 🎯 Key Principles

### 1. **Shareability First**
Every entity (project, asset, event, organization) gets its own shareable link and profile page.

### 2. **Multi-Association**
Entities can be associated with multiple other entities, creating rich relationships.

### 3. **Transparent Funding**
All donations are visible and reflect on associated entities automatically.

### 4. **Bitcoin-Native**
All entities have Bitcoin/Lightning addresses for direct, permissionless payments.

### 5. **User-Centric**
Focus on individual needs first (profiles, projects), then expand to groups (organizations, events).

---

## 💡 Example Use Cases

### Use Case 1: Software Subscription
```
Mao creates:
  - Project: "OrangeCat"
  - Asset: "Cursor Subscription" (associated with OrangeCat project and Mao's profile)

Someone donates 500 CHF BTC to "Cursor Subscription":
  ✅ Cursor Subscription asset page shows: "500 CHF / 500 CHF funded"
  ✅ OrangeCat project shows: "Associated assets: Cursor Subscription (funded)"
  ✅ Mao's profile shows: "Cursor Subscription funded: 500 CHF"
```

### Use Case 2: Event Organization
```
Organization "Bitcoin Zurich" creates:
  - Event: "Bitcoin Meetup Zurich" (associated with organization)

People donate to the event:
  ✅ Event page shows total funding
  ✅ Organization page shows event funding progress
  ✅ Event organizers' profiles reflect their contributions
```

### Use Case 3: Equipment Purchase
```
Project "Community Garden" needs:
  - Asset: "Garden Tools" (associated with project)

Multiple people contribute:
  ✅ Asset page shows cumulative funding
  ✅ Project page shows asset funding status
  ✅ Contributors can see their impact
```

---

## 📝 Notes

- **Current Focus**: Perfect profiles and projects first
- **Future Expansion**: Add assets, events, organizations incrementally
- **User Feedback**: Let user needs drive feature prioritization
- **Technical Debt**: Keep architecture flexible for future additions

---

**Remember**: This is a **living vision**. As we build, we'll learn what users actually need and adjust accordingly. The core principle is **flexibility** - the platform should support any way people want to raise Bitcoin for anything.


