# Live Chat Performance Optimization

## Overview
This document outlines the database and frontend optimizations implemented to ensure fast, seamless chat loading with no delays and a smooth user experience.

## Database Optimizations

### 1. Composite Indexes
Added strategic composite indexes for common query patterns:

- **`idx_chat_sessions_active_recent`**: Optimizes fetching active/waiting sessions ordered by last message
- **`idx_chat_sessions_agent_active`**: Fast lookup for agent's assigned active chats
- **`idx_chat_sessions_last_message`**: Efficient sorting by last message timestamp
- **`idx_chat_sessions_waiting_optimized`**: Optimized for auto-assignment of waiting chats
- **`idx_chat_messages_session_covering`**: Covering index for message queries (includes all commonly selected columns)
- **`idx_chat_messages_unread_covering`**: Optimized for unread message queries

### 2. Optimized Database Functions
Created PostgreSQL functions that perform joins server-side, reducing round trips:

- **`get_chat_sessions_with_assignees()`**: Fetches sessions with assignee names in a single query using JOINs
- **`get_chat_messages_with_senders()`**: Fetches messages with sender names in a single query
- **`get_agent_active_chats_count()`**: Fast lookup for agent's active chat count (marked as STABLE for query optimization)

### 3. Trigger Optimizations
- Updated `update_agent_chat_count()` trigger to recalculate counts efficiently using subqueries
- Only updates when assignment actually changes (not on every update)
- Uses COUNT(*) queries for accurate counts

### 4. Query Planner Optimization
- Ran `ANALYZE` on all chat-related tables to update statistics for the query planner
- This ensures PostgreSQL chooses optimal query execution plans

## Frontend Optimizations

### 1. Optimized Query Functions
- **`fetchSessions()`**: Now uses `get_chat_sessions_with_assignees()` RPC function for single-query fetching
  - Falls back to multi-query approach if function doesn't exist (backward compatibility)
  - Reduces 3-4 round trips to 1-2 round trips

- **`fetchMessages()`**: Now uses `get_chat_messages_with_senders()` RPC function
  - Includes sender names in the query result
  - Falls back to multi-query approach if needed

### 2. React Performance Optimizations
- Wrapped `fetchSessions`, `fetchMessages`, and `fetchAgentQueueStatus` in `useCallback` to prevent unnecessary re-renders
- Added proper dependency arrays to `useEffect` hooks

### 3. Real-Time Subscription Optimizations
- **Debounced fetching**: Added 300ms debounce to `fetchSessions()` calls from real-time subscriptions
  - Prevents excessive API calls when multiple events fire rapidly
  - Reduces database load and improves UI responsiveness

- **Selective subscriptions**: 
  - Only subscribe to `INSERT` and `UPDATE` events (not `DELETE` unless needed)
  - Messages subscription only refetches if it's for the currently selected session
  - Queue subscription filtered by `admin_id` to only receive relevant updates

### 4. Query Batching
- Ticket numbers are still fetched separately (only when needed)
- All other data is fetched in optimized single queries

## Performance Benefits

### Before Optimization:
- **Sessions fetch**: 3-4 database round trips (sessions → admins → profiles → tickets)
- **Messages fetch**: 2-3 database round trips (messages → admins → profiles)
- **Real-time updates**: Immediate refetch on every event (no debouncing)
- **Index usage**: Basic indexes, not optimized for common query patterns

### After Optimization:
- **Sessions fetch**: 1-2 database round trips (optimized function + tickets if needed)
- **Messages fetch**: 1 database round trip (optimized function with JOINs)
- **Real-time updates**: Debounced (300ms) to prevent excessive calls
- **Index usage**: Composite indexes optimized for exact query patterns
- **Query planner**: Updated statistics ensure optimal execution plans

## Expected Performance Improvements

1. **Initial Load**: 50-70% faster (fewer round trips)
2. **Real-time Updates**: Smoother UI (debounced, less frequent updates)
3. **Message Loading**: 60-80% faster (single query with JOINs)
4. **Database Load**: Reduced by 40-60% (fewer queries, better indexes)
5. **UI Responsiveness**: Improved (debouncing prevents UI blocking)

## Monitoring

To monitor performance:
1. Check Supabase dashboard for query execution times
2. Monitor real-time subscription activity
3. Use browser DevTools Network tab to see request counts and timing
4. Check PostgreSQL query logs for slow queries

## Future Optimizations (if needed)

1. **Materialized Views**: For very high-volume scenarios, consider materialized views for agent chat counts
2. **Connection Pooling**: Ensure Supabase connection pooling is configured optimally
3. **Caching**: Add client-side caching for frequently accessed data
4. **Pagination**: Implement cursor-based pagination for large result sets
5. **Lazy Loading**: Load messages only when chat is opened

## Migration Applied

The optimization migration (`20250202_live_chat_performance_optimization.sql`) has been applied to the database and includes:
- All composite indexes
- Optimized database functions
- Updated triggers
- Query planner statistics
- Proper grants and comments

The frontend code has been updated to use these optimized functions with fallback support for backward compatibility.

