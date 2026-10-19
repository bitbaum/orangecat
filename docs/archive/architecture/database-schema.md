---
created_date: 2025-06-05
last_modified_date: 2025-12-21
last_modified_summary: Updated for simplified database schema with unified projects entity and multi-entity transactions
---

# 🗄️ Database Schema Documentation

## Overview
This document describes the **simplified database schema** for the OrangeCat Bitcoin crowdfunding platform. The database uses Supabase and includes 5 core tables optimized for multi-entity transactions and transparency.

**Key Features:**
- **5 Essential Tables** (simplified from 10+)
- **Unified Projects Entity** (consolidated campaigns + projects)
- **Multi-Entity Transactions** (any entity can donate to any other)
- **Bitcoin-Native Design** (Lightning/Bitcoin addresses for all entities)
- **Transparency by Default** (public transaction visibility)

## Tables

## Tables

### 1. Profiles (User Accounts)
Stores simplified user profile information.

| Column          | Type      | Nullable | Description                               |
|-----------------|-----------|----------|-------------------------------------------|
| id              | uuid      | No       | Primary key, references `auth.users.id`   |
| username        | text      | Yes      | User-chosen unique username               |
| name            | text      | Yes      | User's display name (standardized)        |
| bio             | text      | Yes      | Short user biography                      |
| avatar_url      | text      | Yes      | URL to profile picture                    |
| bitcoin_address | text      | Yes      | User's Bitcoin address for donations      |
| lightning_address | text    | Yes      | User's Lightning address for payments     |
| verification_status | text   | Yes      | Account verification status              |
| status          | text      | Yes      | Profile status (active/suspended)        |
| created_at      | timestamp | No       | Record creation timestamp (UTC)           |
| updated_at      | timestamp | No       | Last update timestamp (UTC)               |

### 2. Projects (Unified Fundraising Entity)
Stores project information with optional fundraising capabilities.

| Column          | Type      | Nullable | Description                               |
|-----------------|-----------|----------|-------------------------------------------|
| id              | uuid      | No       | Primary key                              |
| title           | text      | No       | Project title                            |
| description     | text      | Yes      | Project description                      |
| goal_amount     | bigint    | Yes      | Target funding in satoshis (optional)    |
| current_amount  | bigint    | No       | Current funding in satoshis              |
| currency        | text      | No       | Currency (SATS/BTC)                      |
| creator_id      | uuid      | No       | References profiles (who created)        |
| organization_id | uuid      | Yes      | References organizations (optional owner)|
| bitcoin_address | text      | Yes      | Project Bitcoin address (optional)       |
| lightning_address | text    | Yes      | Project Lightning address (optional)     |
| status          | text      | No       | Project status (draft/active/completed)  |
| category        | text      | Yes      | Project category                         |
| tags            | text[]    | Yes      | Project tags                             |
| start_date      | timestamp | Yes      | Project start date (optional)            |
| target_completion | timestamp| Yes      | Target completion date (optional)        |
| created_at      | timestamp | No       | Record creation timestamp (UTC)           |
| updated_at      | timestamp | No       | Last update timestamp (UTC)               |

### 3. Organizations (Group Entities)
Stores organization information.

| Column          | Type      | Nullable | Description                               |
|-----------------|-----------|----------|-------------------------------------------|
| id              | uuid      | No       | Primary key                              |
| name            | text      | No       | Organization name                        |
| slug            | text      | No       | URL-friendly identifier                  |
| description     | text      | Yes      | Organization description                 |
| founder_id      | uuid      | No       | References profiles (who founded)        |
| bitcoin_address | text      | Yes      | Organization Bitcoin address             |
| lightning_address | text    | Yes      | Organization Lightning address           |
| wallet_balance  | decimal   | No       | Organization wallet balance              |
| created_at      | timestamp | No       | Record creation timestamp (UTC)           |

### 4. Organization Members (Team Management)
Manages organization membership and roles.

| Column          | Type      | Nullable | Description                               |
|-----------------|-----------|----------|-------------------------------------------|
| id              | uuid      | No       | Primary key                              |
| organization_id | uuid      | No       | References organizations                 |
| profile_id      | uuid      | No       | References profiles                      |
| role            | text      | No       | Member role (founder/admin/member)       |
| joined_at       | timestamp | No       | When member joined                       |

### 5. Transactions (Multi-Entity Payments)
Universal payment system supporting donations between any entities.

| Column          | Type      | Nullable | Description                               |
|-----------------|-----------|----------|-------------------------------------------|
| id              | uuid      | No       | Primary key                              |
| amount_sats     | bigint    | No       | Transaction amount in satoshis           |
| currency        | text      | No       | Currency (SATS/BTC)                      |
| from_entity_type| text      | No       | Source entity type (profile/org/project) |
| from_entity_id  | uuid      | No       | Source entity ID                         |
| to_entity_type  | text      | No       | Destination entity type                  |
| to_entity_id    | uuid      | No       | Destination entity ID                    |
| payment_method  | text      | No       | Payment method (bitcoin/lightning)       |
| transaction_hash| text      | Yes      | Bitcoin transaction hash                 |
| lightning_payment_hash | text | Yes      | Lightning payment hash                   |
| status          | text      | No       | Transaction status (pending/confirmed)   |
| fee_sats        | bigint    | No       | Transaction fee in satoshis              |
| purpose         | text      | Yes      | Transaction purpose (funding/tip/grant)  |
| public_visibility| boolean  | No       | Whether transaction is public            |
| anonymous       | boolean   | No       | Whether transaction is anonymous         |
| message         | text      | Yes      | Optional message from sender             |
| initiated_at    | timestamp | No       | When transaction was initiated           |
| confirmed_at    | timestamp | Yes      | When transaction was confirmed           |
| created_at      | timestamp | No       | Record creation timestamp (UTC)           |
| updated_at      | timestamp | No       | Last update timestamp (UTC)               |
| amount | decimal | Transaction amount |
| status | text | Transaction status (pending/completed) |
| created_at | timestamp | Record creation timestamp |
| updated_at | timestamp | Last update timestamp |

