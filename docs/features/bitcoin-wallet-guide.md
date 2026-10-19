# Bitcoin Wallet Guide Feature

**Created**: 2025-06-05  
**Last Modified**: 2025-12-11  
**Last Modified Summary**: Documented wallet tab visibility and send flow improvements

## Overview

The Bitcoin Wallet Guide is a dedicated page that helps users who don't have a Bitcoin wallet get one set up quickly and easily. This feature addresses a common barrier for new users who want to receive Bitcoin donations on OrangeCat but don't know how to get started with Bitcoin.

## Purpose

Many users come to OrangeCat wanting to create projects or profiles but get stuck when asked for a Bitcoin address because they don't have a Bitcoin wallet yet. This guide provides:

1. **Clear explanations** of what a Bitcoin wallet is
2. **Curated wallet recommendations** with pros/cons
3. **Step-by-step guidance** for getting started
4. **Security best practices** for new users
5. **FAQ section** addressing common concerns

## Implementation

### Page Location

- **URL**: `/bitcoin-wallet-guide`
- **File**: `src/app/(public)/bitcoin-wallet-guide/page.tsx` (wallet data in `config.ts` beside it)

### Integration Points

The guide is linked from three key locations where Bitcoin addresses are requested:

1. **Profile Setup** (`src/app/profile/setup/page.tsx`)
   - Shows when Bitcoin address field is empty
   - Appears in the "payment-info" step

2. **Campaign Creation** (`src/app/create/page.tsx`)
   - Shows when Bitcoin address field is empty
   - Appears in step 2 "Payment Setup"

3. **Profile Editing** (`src/app/(authenticated)/profile/page.tsx`)
   - Shows when Bitcoin address field is empty
   - Appears in the "Bitcoin & Lightning" section

### Design System Compliance

The page follows OrangeCat's design system:

- Uses **Bitcoin Orange** (#F7931A) for all Bitcoin-related elements
- Implements the centralized theme system from `src/config/theme.ts`
- Uses `BitcoinBadge` component for consistent Bitcoin branding
- Follows responsive design patterns with mobile-first approach

## Features

### Wallet Recommendations

The guide includes curated wallet options:

1. **Brave Wallet** (Recommended)
   - Browser-integrated
   - Beginner-friendly
   - Self-custody
   - Multi-chain support

2. **BlueWallet**
   - Bitcoin-only mobile wallet
   - Lightning Network support
   - Open source

3. **Exodus**
   - User-friendly desktop wallet
   - Multi-cryptocurrency support
   - Built-in exchange

4. **Electrum**
   - Lightweight Bitcoin wallet
   - Advanced features
   - Hardware wallet support

### Interactive Elements

- **Step-by-step progress tracker** with clickable steps
- **Wallet comparison cards** with selection functionality
- **Detailed pros/cons** for each wallet option
- **Direct download links** to official wallet websites
- **FAQ section** addressing common concerns

### Security Features

- **Security warnings** about downloading from official sources only
- **Recovery phrase education** about backup importance
- **Best practices** for wallet security
- **Clear warnings** about potential risks

## User Experience

### Target Audience

- **Primary**: Complete Bitcoin beginners
- **Secondary**: Users familiar with crypto but new to Bitcoin
- **Tertiary**: Existing Bitcoin users looking for wallet alternatives

### User Journey

1. User encounters Bitcoin address field (empty)
2. Sees helpful prompt with link to wallet guide
3. Clicks link → opens guide in new tab
4. Follows guide to set up wallet
5. Returns to original form with Bitcoin address
6. Completes profile/project setup

### Accessibility

- **Keyboard navigation** support
- **Screen reader** friendly
- **High contrast** design elements
- **Touch-friendly** buttons for mobile
- **Clear visual hierarchy** with proper heading structure

## Technical Implementation

### Components Used

- `BitcoinBadge` - For consistent Bitcoin branding
- `Card` components - For wallet option layouts
- `Button` - For CTAs and navigation
- `motion` from Framer Motion - For smooth animations

### Theme Integration

```tsx
import { componentColors, getColorClasses } from '@/lib/theme';

// Bitcoin elements automatically get Bitcoin Orange
<div className={componentColors.bitcoinElement.className}>Bitcoin content</div>;
```

### Responsive Design

- **Mobile-first** approach
- **Grid layouts** that adapt to screen size
- **Touch-friendly** interactive elements
- **Readable typography** at all sizes

## Content Strategy

### Educational Approach

- **Simple language** avoiding technical jargon
- **Visual hierarchy** with clear sections
- **Progressive disclosure** of information
- **Practical examples** and use cases

### Trust Building

- **Official wallet links** only
- **Security warnings** prominently displayed
- **Transparent pros/cons** for each option
- **No affiliate links** or biased recommendations

## Analytics & Metrics

### Success Metrics

- **Conversion rate**: Users who visit guide → complete Bitcoin address setup
- **Bounce rate**: Users who leave guide without taking action
- **Wallet preference**: Which wallets users choose most often
- **Return rate**: Users who come back to complete setup

### Tracking Points

- Guide page visits
- Wallet download link clicks
- Form completion after guide visit
- User feedback on guide helpfulness

## Future Enhancements

### Planned Improvements

1. **Video tutorials** for visual learners
2. **Wallet setup wizards** with screenshots
3. **QR code generation** for easy mobile downloads
4. **Multi-language support** for international users
5. **Integration with wallet APIs** for automatic address verification

### Advanced Features

1. **Wallet comparison tool** with filtering
2. **Security score** for each wallet option
3. **Community reviews** and ratings
4. **Live chat support** for complex questions
5. **Guided setup** with step-by-step screenshots

## Maintenance

### Content Updates

- **Regular review** of wallet recommendations
- **Security advisory** updates when needed
- **New wallet additions** as they become popular
- **Link verification** to ensure official sources

### Technical Maintenance

- **Performance monitoring** for page load times
- **Mobile compatibility** testing
- **Accessibility audits** for compliance
- **SEO optimization** for discoverability

## Related Documentation

- [Design System Guide](../design-system/README.md)
- [Design System](../design-system/README.md)
- [Component Architecture](../development/components/component-architecture.md)

## Support

For questions about this feature:

- **Technical issues**: Check component documentation
- **Design questions**: Refer to design system guide
- **User feedback**: Monitor analytics and user support channels
- **Content updates**: Follow content review process
