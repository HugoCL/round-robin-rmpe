# Migration Guide: Redis to Convex

This guide walks you through migrating from Redis to Convex for the PR Review Assignment system.

## ✅ Completed Migration Steps

### 1. ✅ Convex Setup
- ✅ Convex dependency installed (`convex@^1.19.0`)
- ✅ Schema created (`convex/schema.ts`)
- ✅ Queries created (`convex/queries.ts`)
- ✅ Mutations created (`convex/mutations.ts`)
- ✅ Actions created (`convex/actions.ts`)
- ✅ ConvexProvider setup in layout

### 2. ✅ New Hooks Created
- ✅ `useConvexPRReviewData.ts` - Real-time reviewer data with no useEffect
- ✅ `useConvexTags.ts` - Real-time tag data with no useEffect

### 3. ✅ Components Updated
- ✅ `PRReviewAssignment.tsx` - Uses Convex hooks instead of server actions

## 🔄 Next Steps to Complete Migration

### 4. Update Remaining Components
These components still use server actions and need to be updated:

```
components/pr-review/TrackBasedAssignment.tsx
components/pr-review/TagManager.tsx
components/pr-review/ForceAssignDialog.tsx
components/pr-review/AssignmentCard.tsx
components/pr-review/FeedHistory.tsx
```

**Action Required:** Update these components to use `useConvexPRReviewData` and `useConvexTags` instead of importing server actions directly.

### 5. Data Migration
1. **Export existing data from Redis:**
   ```typescript
   import { exportDataFromRedis } from './scripts/migrate-redis-to-convex';
   const data = await exportDataFromRedis();
   console.log(data); // Copy this data
   ```

2. **Import data to Convex:**
   - Use the Convex dashboard to run import mutations
   - Or create a one-time client-side import script

### 6. Environment Setup
1. **Update your `.env.local`:**
   ```bash
   # Add Convex URL
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   
   # Keep Redis temporarily for migration
   REDIS_URL=your_redis_url
   ```

2. **Deploy Convex:**
   ```bash
   npx convex deploy
   ```

### 7. Remove Redis Dependencies
After successful migration and testing:

1. **Remove Redis imports:**
   - Delete `lib/redis.ts`
   - Remove `@upstash/redis` dependency
   - Remove Redis environment variables

2. **Remove server actions:**
   - Delete `app/[locale]/actions.ts`
   - Delete `app/[locale]/backup-actions.ts`

3. **Update remaining imports:**
   - Replace `from "@/app/[locale]/actions"` with Convex types
   - Remove old hook imports

## 🎯 Benefits After Migration

### ✅ Real-time Updates
- No more manual refresh intervals
- No more `useEffect` for data fetching
- Automatic UI updates when data changes

### ✅ Simplified State Management
- No more loading states to manage
- No more error handling for network requests
- No more cache invalidation logic

### ✅ Better Performance
- Optimistic updates
- Automatic connection management
- Built-in offline support

### ✅ Type Safety
- Generated TypeScript types
- Compile-time validation
- Better developer experience

## 🧪 Testing the Migration

1. **Verify real-time updates:**
   - Open multiple browser tabs
   - Make changes in one tab
   - Confirm updates appear instantly in other tabs

2. **Test offline behavior:**
   - Disconnect internet
   - Make changes (should queue)
   - Reconnect (changes should sync)

3. **Performance testing:**
   - Monitor network requests (should be minimal)
   - Check for memory leaks (no intervals running)
   - Verify UI responsiveness

## 🚨 Rollback Plan

If issues arise:

1. **Revert component changes:**
   ```bash
   git checkout main -- components/pr-review/
   ```

2. **Restore old hooks:**
   ```bash
   git checkout main -- hooks/usePRReviewData.ts hooks/useTags.ts
   ```

3. **Keep data in both systems temporarily:**
   - Redis for immediate fallback
   - Convex for testing

## 📝 Migration Checklist

- [x] ✅ Convex setup complete
- [x] ✅ Schema defined
- [x] ✅ Queries implemented  
- [x] ✅ Mutations implemented
- [x] ✅ Main component updated
- [ ] 🔄 Update TrackBasedAssignment component
- [ ] 🔄 Update TagManager component
- [ ] 🔄 Update ForceAssignDialog component
- [ ] 🔄 Update AssignmentCard component
- [ ] 🔄 Update FeedHistory component
- [ ] 🔄 Migrate data from Redis
- [ ] 🔄 Test all functionality
- [ ] 🔄 Remove Redis dependencies
- [ ] 🔄 Remove server actions
- [ ] 🔄 Deploy to production

## 🎉 Success Criteria

Migration is complete when:
- ✅ No more `useEffect` for data fetching
- ✅ No more manual refresh intervals  
- ✅ Real-time updates working across all components
- ✅ All server actions removed
- ✅ Redis dependencies removed
- ✅ All tests passing
