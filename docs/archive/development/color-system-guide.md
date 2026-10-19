# Color System Developer Guide

**Created**: June 5, 2025
**Last Modified**: June 5, 2025
**Last Modified Summary**: Initial creation of centralized color system guide

## Overview

OrangeCat uses a centralized theme system to eliminate hardcoded colors and ensure consistent branding. This guide explains how to use the system correctly.

## 🚫 What NOT to Do

```tsx
// ❌ NEVER hardcode colors
<div className="bg-orange-100 text-orange-600">Bitcoin</div>
<div style={{ color: '#F7931A' }}>Bitcoin</div>
<div className="text-[#F7931A]">Bitcoin</div>
```

## ✅ What TO Do

```tsx
// ✅ Use the centralized theme system
import { componentColors, getColorClasses } from '@/lib/theme';
import { BitcoinBadge, CurrencyDisplay } from '@/components/ui';

// For Bitcoin badges
<BitcoinBadge>Bitcoin</BitcoinBadge>

// For currency displays
<CurrencyDisplay amount={0.001} currency="BTC" />

// For custom Bitcoin elements
<div className={componentColors.bitcoinElement.className}>
  Bitcoin Element
</div>

// For class generation
<div className={getColorClasses.bitcoin.badge}>
  Bitcoin Badge
</div>
```

## Core Components

### 1. BitcoinBadge
```tsx
import { BitcoinBadge } from '@/components/ui/BitcoinBadge';

<BitcoinBadge variant="default">BTC</BitcoinBadge>
<BitcoinBadge variant="outline">Bitcoin</BitcoinBadge>
<BitcoinBadge variant="solid">₿</BitcoinBadge>
```

### 2. CurrencyDisplay
```tsx
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';

<CurrencyDisplay amount={0.001} currency="BTC" />
<CurrencyDisplay amount={1000} currency="SATS" />
<CurrencyDisplay amount={50000} currency="USD" />
```

## Theme System Structure

### Color Categories
- `colors.bitcoin.main` - Official Bitcoin Orange (#F7931A)
- `colors.primary.main` - Tiffany Blue (#0ABAB5)  
- `colors.secondary.main` - General orange (#FF6B35)
- `colors.status.*` - Success, error, warning, info
- `colors.neutral.*` - Gray scale

### Semantic Colors
- `semanticColors.bitcoin.*` - Bitcoin-specific colors
- `semanticColors.currency.*` - Currency-specific colors
- `semanticColors.status.*` - Status indicators

### Component Colors
- `componentColors.bitcoinElement` - Pre-configured Bitcoin styling
- `componentColors.currencyDisplay()` - Currency-specific styling
- `componentColors.statusBadge()` - Dynamic status colors

## Usage Examples

### Bitcoin-Related Elements
```tsx
// Any Bitcoin-related UI element
<div className={componentColors.bitcoinElement.className}>
  Bitcoin content
</div>

// Bitcoin icon
<BitcoinIcon className={getColorClasses.bitcoin.icon} />

// Bitcoin button
<button className={getColorClasses.bitcoin.hover}>
  Send Bitcoin
</button>
```

### Dynamic Color Assignment
```tsx
// Automatically apply Bitcoin colors based on content
const getBadgeColor = (type: string) => {
  if (type.toLowerCase().includes('bitcoin') || type.toLowerCase().includes('btc')) {
    return componentColors.bitcoinElement.className;
  }
  return 'bg-gray-100 text-gray-600';
};

<span className={getBadgeColor(itemType)}>
  {itemType}
</span>
```

### Currency Styling
```tsx
// Currency amounts with appropriate colors
const CurrencyAmount = ({ amount, currency }) => (
  <span className={componentColors.currencyDisplay(currency).className}>
    {amount} {currency}
  </span>
);
```

## Best Practices

1. **Always Import from Theme**
   ```tsx
   import { componentColors, getColorClasses } from '@/lib/theme';
   ```

2. **Use Semantic Names**
   ```tsx
   // ✅ Good - semantic
   className={getColorClasses.bitcoin.badge}
   
   // ❌ Bad - hardcoded
   className="bg-orange-500 text-white"
   ```

3. **Prefer Components Over Classes**
   ```tsx
   // ✅ Better - component handles everything
   <BitcoinBadge>BTC</BitcoinBadge>
   
   // ✅ Good - manual styling
   <span className={componentColors.bitcoinElement.className}>BTC</span>
   ```

4. **Use Helper Functions**
   ```tsx
   // ✅ Dynamic color assignment
   const getColorForCurrency = (currency) => 
     getCurrencyColor(currency);
   ```

## Migration Guide

When you encounter hardcoded colors:

1. **Identify the Element Type**
   - Is it Bitcoin-related? Use `BitcoinBadge` or `componentColors.bitcoinElement`
   - Is it a currency? Use `CurrencyDisplay`
   - Is it a status? Use `componentColors.statusBadge()`

2. **Replace with Semantic Alternative**
   ```tsx
   // Before
   <span className="bg-orange-100 text-orange-600">Bitcoin</span>
   
   // After
   <BitcoinBadge>Bitcoin</BitcoinBadge>
   ```

3. **Test the Change**
   - Verify colors look correct
   - Check hover states work
   - Ensure accessibility is maintained

## Adding New Colors

If you need a new color:

1. **Add to Theme System**
   ```tsx
   // In src/lib/theme.ts
   export const colors = {
     // ... existing colors
     newCategory: {
       main: '#HEXCODE',
       light: '#HEXCODE',
       dark: '#HEXCODE',
     }
   }
   ```

2. **Create Semantic Mapping**
   ```tsx
   export const semanticColors = {
     // ... existing mappings
     newCategory: {
       background: colors.newCategory.light,
       text: colors.newCategory.main,
       border: colors.newCategory.main,
     }
   }
   ```

3. **Add Helper Classes**
   ```tsx
   export const getColorClasses = {
     // ... existing classes
     newCategory: {
       background: 'bg-newCategory',
       text: 'text-newCategory',
       border: 'border-newCategory',
     }
   }
   ```

## Testing Colors

1. **Visual Testing**
   - Check all Bitcoin elements use Bitcoin Orange
   - Verify hover states work correctly
   - Test in light/dark modes

2. **Accessibility Testing**
   - Ensure sufficient color contrast
   - Test with color blindness simulators
   - Verify focus states are visible

## Troubleshooting

### "Color not working"
1. Check if you imported the theme system
2. Verify you're using the correct semantic name
3. Ensure Tailwind includes the color in config

### "Need custom styling"
1. Use the theme system as base
2. Extend with additional classes
3. Don't override core Bitcoin colors

### "Component doesn't match design"
1. Check if using correct variant
2. Verify theme system has the right colors
3. Consider if design needs updating to match system

## Summary

The centralized theme system ensures:
- ✅ Single source of truth for colors
- ✅ Easy global color changes
- ✅ Consistent Bitcoin branding
- ✅ No hardcoded color values
- ✅ Type-safe color usage
- ✅ Automatic semantic color application

Remember: **If you're hardcoding colors, you're doing it wrong.** 