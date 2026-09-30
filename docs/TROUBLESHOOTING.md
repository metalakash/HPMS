# Troubleshooting Guide

**Version:** 1.0  
**Audience:** Developers, DevOps, Support  
**Last Updated:** 2026-09-30

---

## Mobile App Issues

### App Won't Start

**Symptoms:**
- Red error screen on app launch
- "JavaScript Error" overlay
- App crashes immediately
- Stuck on splash screen

**Diagnosis:**
```bash
# Check Expo logs
expo start --clear

# Check device logs (iOS)
xcrun simctl spawn booted log stream --predicate 'process == "HPMS"'

# Check device logs (Android)
adb logcat | grep -i hpms
```

**Solutions:**
```bash
# Clear cache
rm -rf node_modules package-lock.json
npm install

# Clear Expo cache
expo start --clear

# Reset simulator
xcrun simctl erase all

# Clear app data (physical device)
iOS: Settings → General → iPhone Storage → HPMS → Delete
Android: Settings → Apps → HPMS → Clear Cache → Clear Data
```

**Prevention:**
- Run tests before release
- Check dependencies updates
- Test on simulator first

---

### Network Errors (Cannot Connect to API)

**Symptoms:**
- "Network Error" messages
- API timeouts
- Connection refused errors
- CORS errors in console

**Diagnosis:**
```bash
# Check API endpoint
curl https://api.hpms.hydropower.dev/health

# Check network connectivity
ping api.hpms.hydropower.dev

# Check DNS resolution
nslookup api.hpms.hydropower.dev

# Check app logs
expo logs
```

**Check Configuration:**
```bash
# Verify .env variables
echo $EXPO_PUBLIC_API_URL
# Should be: https://api.hpms.hydropower.dev (not localhost)

# On physical device, use WiFi (not cellular)
# Same network as dev machine
```

**Solutions:**
```bash
# If localhost connection fails:
# 1. iOS: Add to Info.plist
<key>NSLocalNetworkUsageDescription</key>
<string>HPMS needs access to local network</string>

# 2. Android: Add to AndroidManifest.xml
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>

# 3. Restart React Native bundle
expo start --clear

# 4. Clear Metro cache
rm -rf node_modules/.cache
```

**Prevention:**
- Use correct API_URL for environment
- Test on physical device
- Check network connectivity
- Verify firewall settings

---

### Offline Sync Not Working

**Symptoms:**
- Changes not saved when offline
- Data not syncing after going online
- Sync queue never clears
- Data loss after offline period

**Diagnosis:**
```bash
# Check WatermelonDB state
// In React DevTools
const db = useLinkDatabase();
await db._dbConnection.unsafeRaw('SELECT COUNT(*) FROM sync_queue');

// Check AsyncStorage
await AsyncStorage.getItem('sync_queue')

// Check network status
NetInfo.fetch().then(state => console.log(state))
```

**Solutions:**
```bash
# Verify offline support enabled
// In app.tsx
import NetInfo from '@react-native-community/netinfo';

// Force sync
const { forceSyncNow } = useSyncManager();
await forceSyncNow();

// Clear sync queue if stuck
await AsyncStorage.removeItem('sync_queue');

// Restart app
```

**Debugging:**
```typescript
// Enable sync logging
const syncLogger = useCallback((event: SyncEvent) => {
  console.log('Sync Event:', event.type, event.status);
}, []);

// Monitor queue status
useEffect(() => {
  const checkQueue = async () => {
    const queue = await AsyncStorage.getItem('sync_queue');
    console.log('Sync Queue:', JSON.parse(queue || '[]'));
  };
  checkQueue();
}, []);
```

**Prevention:**
- Test offline scenarios
- Monitor sync logs
- Verify API connectivity
- Clean up old sync records

---

### Dark Mode Not Working

**Symptoms:**
- Dark mode toggle doesn't apply
- Colors not changing
- Inconsistent theming
- Light mode forced on dark theme device

**Diagnosis:**
```typescript
// Check theme context
import { useTheme } from '@react-native-paper';
const { dark } = useTheme();
console.log('Dark mode:', dark);

// Check device setting
import { Appearance } from 'react-native';
console.log('System theme:', Appearance.getColorScheme());
```

**Solutions:**
```typescript
// Ensure ThemeProvider wraps app
<ThemeProvider theme={customTheme}>
  <App />
</ThemeProvider>

// Use theme variables in StyleSheet
const styles = StyleSheet.create({
  container: {
    backgroundColor: useTheme().colors.background
  }
});

// Force theme refresh
const [theme, setTheme] = useState('auto');
useEffect(() => {
  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    setTheme(colorScheme);
  });
  return subscription.remove();
}, []);
```

**Common Issues:**
- Hardcoded colors instead of theme variables
- Theme provider not wrapping entire app
- Stale theme cache

---

### Performance Issues (Slow/Lagging)

**Symptoms:**
- App feels sluggish
- FlatList lags when scrolling
- Animations are janky
- Memory usage high

**Diagnosis:**
```bash
# Profile with React DevTools Profiler
// In Chrome DevTools
- React → Profiler
- Record session while interacting
- Check which components re-render

# Check memory usage
// React Native DevTools
- Debug → Show Perf Monitor
- Watch JS heap and native memory

# Use console.time
console.time('operation');
await heavyOperation();
console.timeEnd('operation');
```

**Solutions:**
```typescript
// Optimize FlatList
<FlatList
  data={items}
  renderItem={MemoizedItem}  // Use React.memo
  keyExtractor={item => item.id}
  removeClippedSubviews={true}
  maxToRenderPerBatch={10}
  updateCellsBatchingPeriod={50}
/>

// Memoize components
const Item = React.memo(({ item }) => <Text>{item.name}</Text>);

// Use useCallback for event handlers
const handlePress = useCallback(() => {
  onPress();
}, []);

// Lazy load images
<FastImage
  source={{ uri: imageUrl }}
  onProgress={handleProgress}
/>
```

**Prevention:**
- Use React DevTools profiler
- Test on real devices
- Monitor memory usage
- Implement lazy loading

---

## Backend Issues

### Database Migration Failed

**Symptoms:**
- Deployment halts at migration step
- "Alembic migration failed" error
- Database in inconsistent state
- Cannot restart service

**Diagnosis:**
```bash
# Check migration status
alembic current
alembic history | tail -20

# Check failed migration
alembic upgrade -m "message"

# Test migration locally
python -m alembic upgrade head --sql
```

**Solutions:**
```bash
# Rollback one migration
alembic downgrade -1

# Verify state
alembic current

# Fix migration file if needed
# Edit alembic/versions/[file].py

# Re-run migration
alembic upgrade head

# If still failing:
# 1. Check database state
psql $DATABASE_URL -c "\dt"

# 2. Manually fix schema
psql $DATABASE_URL -c "ALTER TABLE ... "

# 3. Update migration
# 4. Re-run
```

**Prevention:**
- Test migrations locally first
- Keep migrations simple and reversible
- Test on staging before production
- Backup database before migrations

---

### Database Connection Issues

**Symptoms:**
- "Connection refused" errors
- "Too many connections" errors
- Timeout errors
- Stale connections hanging

**Diagnosis:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection limits
psql $DATABASE_URL -c "SHOW max_connections;"

# Check connection pooling
psql $DATABASE_URL -c "SELECT datname, pid, state FROM pg_stat_activity WHERE datname='hpms';"
```

**Solutions:**
```bash
# Kill stale connections
psql $DATABASE_URL -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'hpms' AND pid != pg_backend_pid();
"

# Increase pool size
# In .env: DATABASE_POOL_SIZE=30

# Reduce pool timeout
# In .env: DATABASE_POOL_TIMEOUT=20

# Restart connection pool
# Render Dashboard → Web Service → Restart
```

**Prevention:**
- Monitor connection pool size
- Set appropriate timeouts
- Implement circuit breaker
- Use read replicas

---

### Import/Export Fails

**Symptoms:**
- "Invalid file format" errors
- Partial data imported
- Export creates corrupted file
- Process times out

**Diagnosis:**
```bash
# Check file format
file uploaded_file.csv

# Validate CSV
python -m csv uploaded_file.csv

# Check file size
ls -lh uploaded_file.csv

# Check logs
curl https://api.hpms.hydropower.dev/logs?service=import
```

**Solutions:**
```bash
# Ensure correct format
# CSV: comma-separated, proper headers
# JSON: valid JSON array
# Excel: xlsx format

# Verify file size
# Max: 100MB, should chunk if larger

# Check encoding
# Must be UTF-8

# Test locally first
python scripts/test_import.py uploaded_file.csv

# Use batch import for large files
# Split into 10,000 record chunks
```

**Prevention:**
- Validate file before upload
- Provide format examples
- Document schema requirements
- Implement chunked uploads

---

### API Rate Limiting

**Symptoms:**
- "429 Too Many Requests" errors
- Retry-After header in response
- Repeated request failures
- Sudden service unavailability

**Diagnosis:**
```bash
# Check rate limit status
curl -I https://api.hpms.hydropower.dev/links
# Look for headers:
# X-RateLimit-Limit: 1000
# X-RateLimit-Remaining: 500
# X-RateLimit-Reset: 1696029600

# Check request frequency
# Count requests in logs

# Identify culprit
# Search logs for specific API key
```

**Solutions:**
```python
# Implement exponential backoff
import time
import random

def retry_with_backoff(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except RateLimitError as e:
            if attempt == max_retries - 1:
                raise
            wait_time = (2 ** attempt) + random.random()
            time.sleep(wait_time)

# Batch requests when possible
# Instead of individual calls, use batch endpoints

# Reduce request frequency
# Cache results
# Increase polling interval

# Request higher quota
# Contact: support@hpms.dev
```

**Prevention:**
- Implement caching
- Use batch endpoints
- Monitor request rate
- Set up alerts at 80% limit

---

## Frontend Issues

### Build Fails

**Symptoms:**
- "npm run build" fails
- "ENOENT" or "ENOMEM" errors
- Module not found errors
- TypeScript compilation errors

**Diagnosis:**
```bash
# Check build output
npm run build 2>&1 | head -50

# Check Node version
node --version  # Should be 18+

# Check disk space
df -h

# Check memory
free -h
```

**Solutions:**
```bash
# Clear build artifacts
rm -rf build dist .next node_modules/.cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run type-check

# Try build locally
npm run build

# Increase Node memory
NODE_OPTIONS=--max-old-space-size=4096 npm run build
```

**Prevention:**
- Run tests before build
- Check TypeScript errors
- Verify all imports
- Test on CI pipeline

---

### API Connectivity Issues

**Symptoms:**
- Network errors in console
- API calls always fail
- CORS errors
- Timeout errors

**Diagnosis:**
```bash
# Check API endpoint
curl https://api.hpms.hydropower.dev/health

# Check CORS headers
curl -H "Origin: https://hpms.vercel.app" \
  https://api.hpms.hydropower.dev/health -v

# Check DNS
nslookup api.hpms.hydropower.dev

# Check browser console
// Open DevTools → Console
// Look for CORS, network, or auth errors
```

**Solutions:**
```bash
# Verify environment variables
echo $REACT_APP_API_URL
# Should be: https://api.hpms.hydropower.dev

# Check CORS configuration
# Backend: cors_origins in .env
# Should include: https://hpms.vercel.app

# Test API manually
curl -X GET https://api.hpms.hydropower.dev/health

# Check browser cache
# Clear browser cache: Cmd+Shift+Delete
```

**Prevention:**
- Test API connection after deploy
- Monitor CORS configuration
- Set correct API_URL per environment
- Test in different browsers

---

### State Management Issues

**Symptoms:**
- State not updating
- Component not re-rendering
- Lost state on page refresh
- Inconsistent state

**Diagnosis:**
```typescript
// Check Redux/Zustand state
import { useStore } from './store';
const state = useStore();
console.log('State:', state);

// Check middleware
// Redux: Redux DevTools extension
// Zustand: Manual logging

// Check localStorage
localStorage.getItem('app_state')
```

**Solutions:**
```typescript
// Verify store initialization
const store = create((set) => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 }))
}));

// Ensure provider wraps app
<StoreProvider>
  <App />
</StoreProvider>

// Persist state
const useStore = create(
  persist(
    (set) => ({ /* state */ }),
    { name: 'app-storage' }
  )
);

// Debug state changes
store.subscribe((state) => {
  console.log('State changed:', state);
});
```

**Prevention:**
- Use Redux DevTools
- Test state management
- Write integration tests
- Monitor state changes

---

## Getting Help

### Before Contacting Support

1. **Search Documentation**
   - API Reference: api.hpms.dev/docs
   - Component Library: docs/COMPONENT_LIBRARY.md
   - Deployment Guides: docs/DEPLOY_*.md
   - GitHub Issues: github.com/hpms/*/issues

2. **Check Status Page**
   - Status: status.hpms.dev
   - Incidents: status.hpms.dev/incidents

3. **Review Logs**
   - Browser console
   - Server logs
   - Error tracking (Sentry)

### Contact Channels

| Issue Type | Channel | Response Time |
|-----------|---------|----------------|
| Bug report | GitHub Issues | < 24h |
| Feature request | Discussions | < 48h |
| Urgent issue | Slack #support | < 1h |
| Security issue | security@hpms.dev | < 4h |
| General question | Email support@hpms.dev | < 24h |

### Create Good Issue Reports

```markdown
## Issue Title
Clear, descriptive title

## Description
What is happening vs what should happen

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Environment
- OS: macOS 13.0
- Node: 18.0
- Browser: Chrome 120
- App Version: 1.2.3

## Logs/Screenshots
Attach relevant logs or screenshots

## Additional Context
Any other relevant information
```

---

## Additional Resources

- **Status Page:** status.hpms.dev
- **API Documentation:** api.hpms.dev/docs
- **Community Forum:** discuss.hpms.dev
- **GitHub Discussions:** github.com/hpms/*/discussions
- **Blog Posts:** blog.hpms.dev
- **Video Tutorials:** youtube.com/@hpmsdev
