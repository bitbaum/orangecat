# 🛠️ Browser DevTools Guide for OrangeCat

**Complete guide to using browser DevTools for debugging and optimizing OrangeCat applications.**

## 🎯 DevTools Philosophy

**"See what the user sees"** - Browser DevTools let you experience your application exactly as users do.

## 🔍 Essential DevTools Tabs

### 1. **Console Tab** - JavaScript Debugging
```javascript
// Check for errors
console.error('Debug message');

// Log variables
console.log('User data:', userData);

// Monitor performance
console.time('Operation');
someOperation();
console.timeEnd('Operation');

// Group related logs
console.group('User Profile');
console.log('Name:', user.name);
console.log('Email:', user.email);
console.groupEnd();
```

### 2. **Network Tab** - HTTP Request Monitoring
- **Monitor API calls** - See all network requests
- **Check response times** - Identify slow endpoints
- **Inspect payloads** - View request/response data
- **Check headers** - Verify authentication and caching

### 3. **Elements Tab** - DOM Inspection
- **Inspect HTML structure** - See rendered DOM
- **Check CSS styles** - View computed styles
- **Test responsive design** - Toggle device simulation
- **Edit elements** - Modify HTML/CSS live

### 4. **Sources Tab** - Code Debugging
- **Set breakpoints** - Pause execution at specific lines
- **Step through code** - Debug function execution
- **View call stack** - Understand execution flow
- **Watch variables** - Monitor variable changes

### 5. **Performance Tab** - Performance Analysis
- **Record profiles** - Capture performance data
- **Analyze flame graphs** - Identify bottlenecks
- **Check Core Web Vitals** - Monitor user experience metrics
- **Memory analysis** - Detect memory leaks

### 6. **Application Tab** - Storage & State
- **Local/Session storage** - View stored data
- **Cookies** - Inspect authentication tokens
- **Cache** - Check cached resources
- **Service workers** - Debug PWA functionality

## 🚀 Quick Start Workflow

### 1. **Basic Debugging**
```javascript
// 1. Open DevTools (F12 or Ctrl+Shift+I)
// 2. Go to Console tab
// 3. Look for errors (red messages)
// 4. Check Network tab for failed requests
// 5. Use Sources tab to set breakpoints
```

### 2. **Performance Investigation**
```javascript
// 1. Go to Performance tab
// 2. Click "Record" button
// 3. Perform the slow operation
// 4. Click "Stop" and analyze results
// 5. Look for long tasks or slow network requests
```

### 3. **Network Debugging**
```javascript
// 1. Go to Network tab
// 2. Perform the action that makes API calls
// 3. Look for slow or failed requests (red/pink)
// 4. Click on requests to see details
// 5. Check response headers and body
```

## 🛠️ Advanced DevTools Techniques

### Custom Console Commands
```javascript
// Add helper functions to console
window.debugUser = (userId) => {
  console.log('User data:', getUser(userId));
  console.log('User permissions:', getUserPermissions(userId));
};

// Use in console: debugUser('user-123')
```

### Performance Monitoring
```javascript
// Monitor Core Web Vitals
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.value}`);
  }
});

observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
```

### Memory Leak Detection
```javascript
// Check for memory leaks
// 1. Go to Memory tab
// 2. Take heap snapshot before operation
// 3. Perform operation multiple times
// 4. Take another snapshot
// 5. Compare snapshots for growing objects
```

### Network Request Inspection
```javascript
// Intercept and modify requests
// 1. Go to Network tab
// 2. Right-click on request → "Block request URL"
// 3. Or use "Override" to modify responses
```

## 🔧 OrangeCat-Specific Debugging

### Authentication Debugging
```javascript
// Check auth state
console.log('Auth state:', {
  user: window.__NEXT_DATA__?.props?.pageProps?.user,
  session: localStorage.getItem('supabase.auth.token')
});

// Debug login flow
// 1. Go to Network tab
// 2. Perform login
// 3. Check for auth requests and responses
```

### Database Query Debugging
```javascript
// Monitor Supabase queries
// 1. Open Network tab
// 2. Filter by "supabase.orangecat.ch"
// 3. Check query performance and responses
// 4. Look for N+1 query problems
```

### Bitcoin Integration Debugging
```javascript
// Debug Bitcoin operations
console.log('Bitcoin address validation:', isValidBitcoinAddress(address));
console.log('Lightning address validation:', isValidLightningAddress(address));

// Monitor wallet operations
// 1. Check Network tab for wallet API calls
// 2. Verify Bitcoin address formats
// 3. Check transaction confirmations
```

## 📊 Performance Optimization

### Bundle Analysis
```javascript
// Check bundle size impact
// 1. Go to Network tab
// 2. Look at JavaScript files
// 3. Identify large chunks
// 4. Use bundle analyzer to optimize
```

### React Performance Profiling
```javascript
// Use React DevTools Profiler
// 1. Install React DevTools extension
// 2. Go to Profiler tab
// 3. Record component renders
// 4. Identify unnecessary re-renders
```

### Image Optimization
```javascript
// Check image loading performance
// 1. Go to Network tab
// 2. Look for image requests
// 3. Check if images are properly optimized
// 4. Verify lazy loading implementation
```

## 🐛 Common Issues & Solutions

### Console Errors
```javascript
// Check for React errors
// 1. Look for red error messages in Console
// 2. Check for React warnings (yellow)
// 3. Fix hydration mismatches
// 4. Resolve prop validation errors
```

### Network Issues
```javascript
// Debug API failures
// 1. Check request status codes
// 2. Inspect request/response headers
// 3. Verify CORS configuration
// 4. Check authentication tokens
```

### Performance Issues
```javascript
// Identify performance bottlenecks
// 1. Use Performance tab to record profiles
// 2. Look for long tasks in flame graph
// 3. Check for layout thrashing
// 4. Monitor memory usage
```

### State Management Issues
```javascript
// Debug state problems
// 1. Check React DevTools for state changes
// 2. Monitor component re-renders
// 3. Verify state updates are correct
// 4. Check for stale closures
```

## 🔧 DevTools Setup & Configuration

### Chrome DevTools Settings
```javascript
// Recommended settings
// 1. Enable "Preserve log" in Console
// 2. Enable "Disable cache" for debugging
// 3. Set "Network throttling" to "Slow 3G" for mobile testing
// 4. Enable "Show timestamps" in Console
```

### VS Code Integration
```json
// .vscode/settings.json
{
  "debug.javascript.usePreview": true,
  "debug.javascript.autoAttachFilter": "onlyWithFlag",
  "debug.node.autoAttach": "on"
}
```

### Custom DevTools Snippets
```javascript
// Create reusable debug snippets
// 1. Go to Sources → Snippets
// 2. Create new snippet with debug helpers
// 3. Run snippets from any page
```

## 📚 DevTools Resources

### Official Documentation
- **[Chrome DevTools](https://developer.chrome.com/docs/devtools/)** - Complete guide
- **[Firefox DevTools](https://firefox-source-docs.mozilla.org/devtools-user/)** - Firefox debugging
- **[Safari DevTools](https://webkit.org/web-inspector/)** - Safari debugging

### Advanced Tools
- **[React DevTools](https://react.dev/learn/react-developer-tools)** - React component debugging
- **[Redux DevTools](https://github.com/reduxjs/redux-devtools)** - State management debugging
- **[Apollo DevTools](https://www.apollographql.com/docs/devtools/)** - GraphQL debugging

### Performance Tools
- **[Lighthouse](https://developers.google.com/web/tools/lighthouse)** - Performance auditing
- **[WebPageTest](https://www.webpagetest.org/)** - Detailed performance analysis
- **[Bundle Analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer)** - Bundle size analysis

## 🆘 Getting Help with DevTools

### **Common Issues**
- **DevTools not opening**: Try F12, Ctrl+Shift+I, or right-click → Inspect
- **Console not showing**: Check if "Console" tab is selected
- **Performance tab missing**: Make sure you're in Chrome (not other browsers)
- **Extensions interfering**: Try incognito mode or disable extensions

### **Learning Resources**
- **Chrome DevTools YouTube Series** - Official video tutorials
- **DevTools Tips & Tricks** - Blog posts and articles
- **Performance Debugging Course** - Free online courses

---

**Last Updated:** October 17, 2025
**DevTools Philosophy:** "Debug what users experience - not what you think they experience"
