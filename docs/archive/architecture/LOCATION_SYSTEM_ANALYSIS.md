# Location System Analysis & Integration

**Created:** 2025-11-24  
**Last Modified:** 2025-11-24  
**Last Modified Summary:** Complete analysis of location system integration with database and search

---

## 🔍 Current Status

### ✅ What's Working

1. **Database Schema** - Fully Ready
   - ✅ Profiles: `location_country`, `location_city`, `location_zip`, `latitude`, `longitude`, `location_search`
   - ✅ Projects: `location_city`, `location_country`, `location_coordinates` (PostGIS POINT)
   - ✅ Indexes: All location fields indexed for performance

2. **Location Input Component** - Working
   - ✅ Nominatim integration saves all fields correctly
   - ✅ Data format matches database schema perfectly
   - ✅ Saves: country, city, zip, lat, lng, formatted address

3. **Form Integration** - Working
   - ✅ `ModernProfileEditor` saves all location fields
   - ✅ Hidden form fields properly mapped

### ❌ What's Missing

1. **Search Function** - Location Filters NOT Implemented
   - ❌ `searchProfiles()` ignores location filters (country, city, zip, radius)
   - ❌ `searchFundingPages()` ignores location filters
   - ❌ Filters are passed but not applied to queries

2. **Radius Search** - Partially Ready
   - ✅ Projects: Have PostGIS POINT (`location_coordinates`) - ready for radius search
   - ⚠️ Profiles: Only have separate `latitude`/`longitude` columns - need PostGIS conversion

---

## 📊 Database Schema Details

### Profiles Table

```sql
location_country TEXT        -- ISO 3166-1 alpha-2 (e.g., 'CH', 'US')
location_city TEXT          -- City name
location_zip TEXT           -- Postal code
location_search TEXT         -- Formatted address (for display)
latitude DOUBLE PRECISION   -- Geographic coordinate
longitude DOUBLE PRECISION  -- Geographic coordinate

-- Indexes:
idx_profiles_location_country
idx_profiles_location_city
idx_profiles_location_zip
idx_profiles_location_coords (latitude, longitude)
```

### Projects Table

```sql
location_city TEXT          -- City name
location_country TEXT        -- ISO country code
location_coordinates POINT  -- PostGIS point (for radius queries)

-- Indexes:
idx_projects_location USING GIST(location_coordinates)
```

---

## 🎯 Required Fixes

### 1. Implement Location Filtering in Search

**File:** `src/services/search.ts`

**Functions to Update:**

- `searchProfiles()` - Add location filters
- `searchFundingPages()` - Add location filters

**Filters to Support:**

- `country` - Filter by country code
- `city` - Filter by city name (ILIKE for partial matches)
- `postal_code` - Filter by zip code
- `radius_km` - Filter by radius (requires lat/lng)

### 2. Add PostGIS Support for Profiles (Optional but Recommended)

**Option A:** Add PostGIS POINT column to profiles (like projects)

- Better for radius queries
- Requires migration

**Option B:** Use manual distance calculation (Haversine formula)

- Works with existing lat/lng columns
- No migration needed
- Less efficient for large datasets

**Recommendation:** Option B for now (manual calculation), Option A later if needed

---

## 🔧 Implementation Plan

### Phase 1: Basic Location Filtering (Country, City, Zip)

1. Update `searchProfiles()` to filter by:
   - `location_country` (exact match)
   - `location_city` (ILIKE for partial matches)
   - `location_zip` (exact match)

2. Update `searchFundingPages()` to filter by:
   - `location_country` (exact match)
   - `location_city` (ILIKE for partial matches)

### Phase 2: Radius Search

1. For Projects:
   - Use PostGIS `ST_DWithin()` with `location_coordinates`

2. For Profiles:
   - Use Haversine formula with `latitude`/`longitude`
   - Or add PostGIS column (requires migration)

---

## 📝 Data Flow

```
User Types Location → LocationInput Component
    ↓
Nominatim API (free, no key)
    ↓
LocationData {
  country: 'CH',
  city: 'Zurich',
  zipCode: '8053',
  latitude: 47.3769,
  longitude: 8.5417,
  formattedAddress: 'Zurich, Zurich, Switzerland'
}
    ↓
Form Submission → ModernProfileEditor
    ↓
Database Save → profiles table
    ↓
Search Query → searchProfiles() / searchFundingPages()
    ↓
Location Filters Applied → Results filtered by location
```

---

## ✅ Verification Checklist

- [x] Database schema supports location fields
- [x] Location input component saves all fields correctly
- [x] Form integration works
- [ ] Search functions filter by location
- [ ] Radius search works for projects
- [ ] Radius search works for profiles
- [ ] Discover page location filters work end-to-end

---

## 🚀 Next Steps

1. **Immediate:** Implement location filtering in search functions
2. **Short-term:** Add radius search support
3. **Long-term:** Consider PostGIS for profiles (if radius search becomes critical)

---

## 📚 References

- [Database Schema](./database/DB_SCHEMA.md)
- [Discover Filters](./discover-filters.md)
- [Location Setup Guide](../development/guides/LOCATION_SETUP.md)
