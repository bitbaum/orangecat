# Currency and Bitcoin Architecture

**Created:** 2026-01-05  
**Last Modified:** 2026-01-05  
**Last Modified Summary:** Complete architecture documentation for currency and Bitcoin integration

## Core Principle

**Users enter amounts in their preferred currency. The system monitors Bitcoin addresses on the blockchain. When the BTC balance (converted to the user's currency) reaches the goal, the user is notified.**

## How It Works

### Example: Project Fundraising

1. **User Creates Project:**
   ```
   Goal: $10,000 USD
   Bitcoin Address: bc1q...
   Currency: USD (user's preference)
   ```

2. **Database Storage:**
   ```sql
   goal_amount = 10000.00  -- Stored in USD
   currency = 'USD'
   bitcoin_address = 'bc1q...'
   bitcoin_balance_btc = 0.0  -- Updated from blockchain
   ```

3. **System Monitors Blockchain:**
   - Periodically checks Bitcoin address via mempool.space/blockstream API
   - Gets BTC balance from blockchain (public data)
   - Stores BTC balance: `bitcoin_balance_btc = 0.05` (example)

4. **Comparison Logic:**
   ```typescript
   // Get current BTC balance
   const btcBalance = project.bitcoin_balance_btc; // 0.05 BTC
   
   // Get current exchange rate
   const btcToUsd = await getExchangeRate('BTC', 'USD'); // $97,000/BTC
   
   // Convert BTC balance to user's currency
   const balanceInUserCurrency = btcBalance * btcToUsd; // 0.05 * 97000 = $4,850
   
   // Compare with goal
   const goal = project.goal_amount; // $10,000
   const progress = balanceInUserCurrency / goal; // 48.5%
   
   // Check if goal reached
   if (balanceInUserCurrency >= goal) {
     notifyUser('Goal reached!');
   }
   ```

5. **Goal Can Be Reached Two Ways (FIAT ONLY):**
   - **People send BTC:** Balance increases (0.05 → 0.1 BTC)
   - **BTC price increases:** Same BTC = more USD value (0.05 BTC @ $97k = $4,850 → 0.05 BTC @ $200k = $10,000)
   
   **IMPORTANT: BTC/SATS Goals Work Differently:**
   - If goal is in **BTC or SATS**, it can ONLY be reached by people sending Bitcoin
   - BTC price appreciation does NOT affect BTC/SATS goals (they're Bitcoin-native)
   - Example: Goal of 0.1 BTC requires exactly 0.1 BTC in donations, regardless of BTC price

## Database Schema

### Amount Storage

**All amounts stored in user's currency (numeric):**

```sql
-- Projects
goal_amount numeric(20, 8)     -- $10,000.00 (in USD if currency='USD')
currency text                   -- 'USD', 'CHF', 'EUR', 'BTC', 'SATS'
bitcoin_address text            -- 'bc1q...'
bitcoin_balance_btc numeric(20, 8)  -- 0.05 (BTC from blockchain)

-- Events
ticket_price numeric(20, 8)     -- $50.00 (in USD if currency='USD')
currency text                   -- 'USD'

-- Products
price numeric(20, 8)           -- $25.00 (in USD if currency='USD')
currency text                   -- 'USD'
```

### Bitcoin Balance

**BTC balance comes from blockchain, stored separately:**

```sql
bitcoin_balance_btc numeric(20, 8)  -- Always in BTC, from blockchain
bitcoin_balance_updated_at timestamptz  -- Last blockchain check
```

## Conversion Flow

### 1. User Input → Storage

```
User enters: $10,000
↓
Form stores: goal_amount = 10000, currency = 'USD'
↓
Database: goal_amount = 10000.00, currency = 'USD'
```

**No conversion happens here!** Amount is stored exactly as entered.

### 2. Blockchain Monitoring → Comparison

**For FIAT Goals (USD, CHF, EUR):**
```
Blockchain API: balance = 0.05 BTC
↓
Store: bitcoin_balance_btc = 0.05
↓
Get exchange rate: BTC/USD = 97000
↓
Convert: 0.05 BTC * 97000 = $4,850 USD
↓
Compare: $4,850 < $10,000 → Not reached yet
↓
Goal can be reached by: Donations OR price appreciation
```

**For BTC/SATS Goals:**
```
Blockchain API: balance = 0.05 BTC
↓
Store: bitcoin_balance_btc = 0.05
↓
Goal: 0.1 BTC (stored directly, no conversion)
↓
Compare: 0.05 BTC < 0.1 BTC → Not reached yet
↓
Goal can ONLY be reached by: Donations (price doesn't matter)
```

### 3. Transaction Sending → Satoshi Conversion

```
User wants to send: $50 USD
↓
Get exchange rate: BTC/USD = 97000
↓
Convert: $50 / 97000 = 0.00051546 BTC
↓
Convert to satoshis: 0.00051546 * 100000000 = 51,546 sats
↓
Send transaction: 51,546 sats to recipient
```

**Conversion to satoshis happens ONLY when sending Bitcoin transactions.**

## Services Architecture

### 1. Currency Service (`src/services/currency/index.ts`)

**Purpose:** Convert between currencies for comparison and display

```typescript
// Convert BTC balance to user's currency for comparison
convertFromBTC(btcAmount: number, toCurrency: Currency): number

// Convert user's currency to BTC (for sending transactions)
convertToBTC(amount: number, fromCurrency: Currency): number

// Convert between any currencies
convert(amount: number, fromCurrency: Currency, toCurrency: Currency): number
```

### 2. Bitcoin Monitoring Service

> `src/services/bitcoin/index.ts` had no importers and was removed (2026-10-07).
> Balances: `src/domain/wallets/refreshBalance.ts`; transactions:
> `src/domain/wallets/onchainTransactions.ts`; payment detection:
> `src/lib/bitcoin/mempool.ts`; explorer links: `src/lib/bitcoin/explorer.ts`.

**Purpose:** Fetch BTC balance from blockchain

```typescript
// Get BTC balance from blockchain
fetchBitcoinWalletData(address: string): Promise<BitcoinWalletData>
// Returns: { balance_btc: 0.05, ... }
```

### 3. Goal Comparison Service (NEW - to be created)

**Purpose:** Compare BTC balance with goals in user's currency

```typescript
// Check if goal is reached
async function checkGoalProgress(
  goalAmount: number,
  goalCurrency: Currency,
  btcBalance: number
): Promise<{
  progress: number;  // 0.485 = 48.5%
  balanceInCurrency: number;  // $4,850 (or 0.05 BTC if goalCurrency is BTC)
  goalReached: boolean;
  canReachViaPriceAppreciation: boolean;  // false if BTC/SATS goal
}>

// Implementation logic:
// - If goalCurrency is BTC or SATS: Direct comparison (no conversion)
// - If goalCurrency is fiat: Convert BTC balance to fiat, compare
```

**Key Distinction:**
- **Fiat goals:** Can be reached via donations OR BTC price appreciation
- **BTC/SATS goals:** Can ONLY be reached via donations (Bitcoin-native)

## API Handler Changes

### Before (WRONG):
```typescript
// Convert to satoshis on input
const sats = convertToSats(amount, currency);
await supabase.from('events').insert({
  ticket_price_sats: sats,  // Stored as satoshis
  currency: currency
});
```

### After (CORRECT):
```typescript
// Store amount in user's currency
await supabase.from('events').insert({
  ticket_price: amount,  // Stored as $50.00 (if USD)
  currency: currency
});
```

## Transaction Sending

**Only convert to satoshis when actually sending:**

```typescript
// User wants to pay $50 for event ticket
const amount = 50;  // USD
const currency = 'USD';

// Convert to satoshis ONLY for transaction
const btcAmount = convertToBTC(amount, currency);
const satoshis = btcToSats(btcAmount);

// Send Bitcoin transaction
await sendBitcoinTransaction({
  to: event.bitcoin_address,
  amount: satoshis  // Send in satoshis
});
```

## Key Rules

1. ✅ **Store amounts in user's currency** - No conversion on storage
2. ✅ **Monitor blockchain for BTC balance** - Public data, no conversion needed
3. ✅ **Convert BTC → User currency for comparison** - Real-time conversion
4. ✅ **Convert User currency → Satoshis ONLY when sending** - Transaction time only
5. ✅ **No "sats" terminology** - Except when user explicitly prefers SATS
6. ✅ **Currency is SSOT** - `src/config/currencies.ts` defines all currencies

## Files to Update

### Database
- ✅ Migration created: `20260105000001_remove_sats_terminology.sql`

### Components
- ✅ CurrencyInput updated to store in currency
- ✅ FormField updated

### API Handlers
- Update to store amounts directly (no conversion)
- Remove all `convertToSats` calls on input

### Services
- Create goal comparison service
- Update Bitcoin monitoring to work with currency goals
