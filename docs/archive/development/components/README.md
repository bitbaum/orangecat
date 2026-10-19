# OrangeCat Components

This document provides an overview of OrangeCat's component architecture and guidelines for component development.

## Component Structure

### Layout Components

- Header
- Footer
- Navigation
- Sidebar

### Bitcoin Components

- Address Input
- QR Code
- Transaction List
- Balance Display

### Profile Components

- Profile Card
- Donation History
- Transparency Score
- Settings Panel

## Development Guidelines

### Naming Conventions

- Use PascalCase for component names
- Use camelCase for props and variables
- Prefix with OrangeCat for unique components

### Props

- Use TypeScript interfaces
- Document all props
- Provide default values
- Validate prop types

### Styling

- Use Tailwind CSS
- Follow design system
- Maintain consistency
- Ensure accessibility

## Best Practices

### Performance

- Use React.memo when needed
- Implement lazy loading
- Optimize renders
- Monitor bundle size

### Testing

- Write unit tests
- Test edge cases
- Mock external APIs
- Ensure coverage

### Documentation

- Document props
- Provide examples
- Include usage guidelines
- Update changelog

## Component Structure

```
src/
├── components/
│   ├── layout/          # Layout components (Header, Footer, etc.)
│   ├── transparency/    # Transparency-related components
│   ├── bitcoin/         # Bitcoin-related components
│   └── common/          # Shared components
```

## Component Categories

### 1. Layout Components

Location: `src/components/layout/`

#### Header

- Responsive navigation
- Mobile menu
- Logo integration
- Navigation links

#### Footer

- Site links
- Social media
- Copyright information

### 2. Transparency Components

Location: `src/components/transparency/`

#### TransparencyScore

- Visual score display
- Color-coded indicators
- Metric calculations

### 3. Bitcoin Components

Location: `src/components/bitcoin/`

#### BalanceCard

- Current balance display
- Refresh functionality
- Loading states

#### TransactionsList

- Transaction history
- Status indicators
- Time formatting

### 4. Common Components

Location: `src/components/common/`

#### Button

- Primary/Secondary variants
- Loading states
- Icon support

#### Card

- Consistent styling
- Content containers
- Shadow effects

## Component Guidelines

### 1. File Structure

```typescript
// ComponentName.tsx
import { FC } from 'react';

interface ComponentNameProps {
  // Props definition
}

export const ComponentName: FC<ComponentNameProps> = ({ prop1, prop2 }) => {
  // Component implementation
};
```

### 2. Props Documentation

- Use TypeScript interfaces
- Document all props
- Include examples
- Specify required props

### 3. Styling

- Use Tailwind classes
- Follow design system
- Maintain consistency
- Document custom styles

### 4. State Management

- Use React hooks
- Document state changes
- Handle loading states
- Manage errors

## Best Practices

### 1. Component Creation

- Single responsibility
- Reusable design
- Proper typing
- Clear documentation

### 2. Code Organization

- Logical grouping
- Clear imports
- Consistent naming
- Proper exports

### 3. Performance

- Memoization when needed
- Lazy loading
- Code splitting
- Optimized renders

### 4. Testing

- Unit tests
- Component tests
- Integration tests
- Accessibility tests

## Component Relationships

### Layout Components

- Header → Navigation
- Footer → Links
- Layout → Page

### Feature Components

- TransparencyScore → Metrics
- BalanceCard → BitcoinService
- TransactionsList → Transaction

### Common Components

- Button → Icon
- Card → Content
- Input → Label

## Implementation Examples

### Basic Component

```typescript
import { FC } from 'react';

interface ExampleProps {
  title: string;
  description?: string;
}

export const Example: FC<ExampleProps> = ({ title, description }) => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-semibold">{title}</h2>
      {description && <p className="mt-2 text-gray-600">{description}</p>}
    </div>
  );
};
```

### Component with State

```typescript
import { FC, useState } from 'react';

interface CounterProps {
  initialValue?: number;
}

export const Counter: FC<CounterProps> = ({ initialValue = 0 }) => {
  const [count, setCount] = useState(initialValue);

  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={() => setCount(count - 1)}
        className="px-4 py-2 bg-tiffany text-white rounded"
      >
        Decrease
      </button>
      <span className="text-xl">{count}</span>
      <button
        onClick={() => setCount(count + 1)}
        className="px-4 py-2 bg-tiffany text-white rounded"
      >
        Increase
      </button>
    </div>
  );
};
```

## Maintenance

### Updating Components

1. Update documentation
2. Test changes
3. Review dependencies
4. Update examples

### Deprecating Components

1. Mark as deprecated
2. Provide alternatives
3. Update documentation
4. Remove in next major version
