# Live Chat Lifecycle Management Implementation

## Overview
This document describes the complete implementation of the live chat lifecycle management system, ensuring proper chat session management, ticket creation, and agent reassignment.

## Key Features

### 1. Chat Session Lifecycle
- **Status Flow**: `waiting` → `active` → `chatting` → `closed` → (new session if customer messages again)
- **Session Persistence**: Chats only end when an admin explicitly closes them and creates a ticket
- **Auto-Assignment**: New chats are automatically assigned to available agents (max 3 chats per agent)

### 2. Close Chat & Create Ticket
- **Function**: `close_chat_and_create_ticket(session_id, admin_id)`
- **Behavior**:
  - Closes the chat session (status → `closed`)
  - Creates a ticket from the chat conversation
  - Links the ticket to the chat session
  - Prevents further messages to the closed chat

### 3. New Session Creation for Closed Chats
- **Function**: `get_or_create_chat_session(visitor_email, visitor_name, visitor_id)`
- **Behavior**:
  - Checks for existing active/chatting sessions for the visitor
  - If found, returns the existing session
  - If previous session is closed, creates a new session
  - Ensures customers can always start a new conversation

### 4. Chat Reassignment
- **Function**: `reassign_chat_to_agent(session_id, new_agent_id, reassigned_by)`
- **Behavior**:
  - Validates target agent is available and has capacity
  - Reassigns chat to new agent
  - Logs the reassignment in `homaradesk_chat_assignments`
  - Updates session status if needed

### 5. Message Prevention for Closed Chats
- **Trigger**: `trigger_prevent_messages_to_closed_chats`
- **Behavior**:
  - Prevents inserting messages into closed or ended chat sessions
  - Raises exception with clear error message
  - Forces creation of new session for closed chats

## Database Schema Updates

### Status Values
```sql
-- Updated status constraint
CHECK (status IN ('waiting', 'active', 'chatting', 'closed', 'ended', 'transferred', 'abandoned'))
```

### New Functions
1. **`get_or_create_chat_session`**: Gets active session or creates new one
2. **`close_chat_and_create_ticket`**: Closes chat and creates ticket
3. **`reassign_chat_to_agent`**: Reassigns chat to another agent

### New Triggers
- **`trigger_prevent_messages_to_closed_chats`**: Prevents messages to closed/ended chats

## Frontend Implementation

### UI Components

#### 1. Chat Header
- **Status Badge**: Shows current chat status with color coding:
  - `active`/`chatting`: Green (default)
  - `closed`/`ended`: Red (destructive)
  - Others: Gray (secondary)
- **Reassign Button**: Dropdown menu showing available agents (only for chats assigned to other agents)
- **Close Chat & Create Ticket Button**: Closes chat and creates ticket (only for active chats)

#### 2. Message Input
- Only shown for `active` or `chatting` status
- Automatically sets status to `chatting` when agent sends first message
- Validates session exists and is active before sending

#### 3. Chat Filtering
- **My Chats**: Shows chats assigned to current agent (active/chatting only)
- **Waiting**: Shows unassigned chats (waiting status)
- **All**: Shows all chats including closed/ended

### State Management
- `availableAgents`: List of available agents for reassignment
- `fetchAvailableAgents()`: Fetches agents who are logged in, available, and have capacity

## Workflow Examples

### Example 1: Normal Chat Flow
1. Customer sends message → New session created (status: `waiting`)
2. Auto-assigned to available agent → Status: `active`
3. Agent responds → Status: `chatting`
4. Conversation continues...
5. Agent clicks "Close Chat & Create Ticket" → Status: `closed`, ticket created
6. Customer sends new message → New session created (previous one is closed)

### Example 2: Chat Reassignment
1. Chat assigned to Agent A (status: `active`)
2. Agent B needs to take over
3. Agent B clicks "Reassign" → Selects Agent B from dropdown
4. Chat reassigned to Agent B → Status remains `active`
5. Assignment logged in `homaradesk_chat_assignments`

### Example 3: Closed Chat Prevention
1. Chat is closed (status: `closed`)
2. Customer tries to send message to closed chat
3. Database trigger prevents message insertion
4. Frontend/backend creates new session automatically
5. New chat assigned to available agent

## Error Handling

### Session Validation
- Before sending messages, validates session exists
- Checks session status (must be `active` or `chatting`)
- Handles foreign key violations gracefully
- Shows clear error messages to users

### Reassignment Validation
- Validates target agent is available
- Checks agent has capacity (< max_concurrent_chats)
- Prevents self-reassignment
- Shows error if agent unavailable

## Security & Permissions

### RLS Policies
- All functions use `SECURITY DEFINER` for proper access control
- Functions validate admin permissions
- Reassignment requires valid admin ID

### Frontend Permissions
- Close chat requires `canManageTickets` permission
- Reassignment available to all agents
- Status visibility based on role

## Performance Optimizations

### Database
- Composite indexes on `homaradesk_chat_messages` for fast queries
- Optimized RPC functions for fetching sessions and messages
- Efficient agent availability checks

### Frontend
- `useCallback` and `useMemo` for performance
- Real-time subscriptions with debouncing
- Efficient filtering and state management

## Testing Checklist

- [x] New chat auto-assigned to available agent
- [x] Agent can send messages (status → `chatting`)
- [x] Close chat creates ticket and marks as `closed`
- [x] Closed chat prevents new messages
- [x] Customer message to closed chat creates new session
- [x] Chat can be reassigned to another agent
- [x] Reassignment validates agent availability
- [x] Status badges show correct colors
- [x] Filtering excludes closed chats from active views
- [x] All chats (including closed) show in "All" tab

## Future Enhancements

1. **Chat History**: Show previous closed chats for same customer
2. **Bulk Reassignment**: Reassign multiple chats at once
3. **Chat Templates**: Pre-filled responses for common issues
4. **Chat Analytics**: Track chat duration, resolution time, etc.
5. **Auto-Close**: Automatically close inactive chats after timeout

