# Date and Time Standards

**Created**: June 5, 2025
**Last Modified**: June 5, 2025
**Last Modified Summary**: Initial creation

## Overview

This document outlines the standards for handling dates and times in the OrangeCat project. We provide scripts to ensure consistent date/time usage across the project.

## Available Scripts

### Node.js Script (`scripts/dev/get_current_datetime.js`)

This script provides the current date and time in various formats and can be used in Node.js applications.

```javascript
// Import the datetime utilities
const datetime = require('./scripts/dev/get_current_datetime.js');

// Use the exported values
console.log(datetime.dateOnly); // YYYY-MM-DD
console.log(datetime.timeOnly); // HH:mm:ss
console.log(datetime.fullDateTime); // YYYY-MM-DD HH:mm:ss
console.log(datetime.iso); // ISO format
console.log(datetime.unixTimestamp); // Unix timestamp
```

### Shell Script (`scripts/dev/get_current_datetime.sh`)

This script provides the current date and time in various formats and can be used in shell scripts.

```bash
# Source the script to get the variables
source ./scripts/dev/get_current_datetime.sh

# Use the exported variables
echo $DATE_ONLY     # YYYY-MM-DD
echo $TIME_ONLY     # HH:mm:ss
echo $FULL_DATETIME # YYYY-MM-DD HH:mm:ss
echo $ISO          # ISO format
echo $UNIX_TIMESTAMP # Unix timestamp
```

## Date/Time Formats

1. **ISO Format** (`YYYY-MM-DDTHH:mm:ss.sssZ`)
   - Used for API responses
   - Used for database timestamps
   - Example: `2025-06-05T14:30:00.000Z`

2. **Date Only** (`YYYY-MM-DD`)
   - Used for documentation dates
   - Used for file naming
   - Example: `2025-06-05`

3. **Time Only** (`HH:mm:ss`)
   - Used for time displays
   - Used for logging
   - Example: `14:30:00`

4. **Full DateTime** (`YYYY-MM-DD HH:mm:ss`)
   - Used for user-facing displays
   - Used for logs
   - Example: `2025-06-05 14:30:00`

5. **Unix Timestamp**
   - Used for calculations
   - Used for sorting
   - Example: `1749215400`

## Best Practices

1. **Documentation Dates**
   - Always use the `YYYY-MM-DD` format
   - Include both creation and last modified dates
   - Include a summary of changes

2. **API Responses**
   - Use ISO format for timestamps
   - Include timezone information
   - Use UTC for consistency

3. **Database**
   - Store timestamps in UTC
   - Use ISO format for queries
   - Include timezone information

4. **User Interface**
   - Use the user's local timezone
   - Format dates according to user's locale
   - Show relative time when appropriate

## Usage in Documentation

When creating or modifying documentation, use the following format:

```markdown
**Created**: YYYY-MM-DD
**Last Modified**: YYYY-MM-DD
**Last Modified Summary**: Brief description of changes
```

## Usage in Code

When working with dates in code:

1. **JavaScript/TypeScript**

   ```typescript
   import { dateOnly, timeOnly } from './scripts/dev/get_current_datetime.js';

   // Use the imported values
   const createdAt = dateOnly;
   const lastModified = dateOnly;
   ```

2. **Shell Scripts**

   ```bash
   source ./scripts/dev/get_current_datetime.sh

   # Use the exported variables
   echo "Created: $DATE_ONLY"
   echo "Last Modified: $DATE_ONLY"
   ```

## Timezone Handling

1. **Server-side**
   - Always use UTC
   - Convert to local time only for display
   - Store timezone information with dates

2. **Client-side**
   - Use the user's local timezone
   - Convert UTC to local time for display
   - Handle daylight saving time changes

## Validation

Always validate dates using the following rules:

1. Check for valid date format
2. Ensure dates are not in the future (unless specifically required)
3. Validate timezone information
4. Handle invalid dates gracefully

## Error Handling

When dealing with dates:

1. Always use try-catch blocks
2. Provide meaningful error messages
3. Log date-related errors
4. Handle timezone conversion errors
