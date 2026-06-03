# FTJM Chat - App Implementation Guide

Je app is nu volledig geconfigureerd om met de RLS policies te werken!

## 🚀 Quick Start

### 1. Database Setup (Already Done for You!)

Je hebt nu deze database service modules:

```
packages/web/src/lib/
├── supabase.ts              ← Supabase client
├── db.ts                    ← Main exports & helpers
├── db-conversations.ts      ← DM functions
├── db-posts.ts             ← General chat functions
├── db-profiles.ts          ← Profile & notification functions
├── db-forum.ts             ← Forum functions
├── types.ts                ← TypeScript types
└── README.md               ← Full API documentation
```

### 2. Features Implemented

#### 💬 Direct Messages (DMs)
- [x] Get all conversations
- [x] Send messages
- [x] Real-time message updates
- [x] Typing indicator ("User is typing...")
- [x] Soft delete messages
- [x] Only participants can see

#### 📢 General Chat
- [x] Post to public channel
- [x] Everyone can see posts
- [x] Real-time new posts
- [x] Edit/delete own posts
- [x] Only author or admin can modify

#### 📝 Forum
- [x] Create discussion threads
- [x] Post comments
- [x] Real-time thread updates
- [x] Category support
- [x] Public visibility

#### 👤 Profiles
- [x] Own profile management
- [x] Display name, bio, photo
- [x] Theme preference (dark/light)
- [x] Notification settings
- [x] Private by default

#### 🔔 Notifications
- [x] Create notifications
- [x] Mark as read
- [x] Sound/desktop alerts
- [x] Real-time updates

#### ⌨️ Other
- [x] Nicknames (@mentions)
- [x] Reports/moderation
- [x] Whitelist management

---

## 📚 Usage Examples

### Send a DM

```typescript
import { createConversation, sendMessage } from '@/lib/db'

// Create conversation with friend
const conversation = await createConversation(
  [myUserId, friendUserId],
  [myName, friendName],
  [myPhoto, friendPhoto],
  myUserId
)

// Send message
await sendMessage(conversation.id, myUserId, "Hey! How are you?")
```

### Post to General Chat

```typescript
import { createPost } from '@/lib/db'

await createPost(
  myUserId,
  "Check this out!",
  "This is visible to everyone in the general chat"
)
```

### Watch for Real-time Updates

```typescript
import { subscribeToMessages, subscribeToGeneralChat } from '@/lib/db'

// Listen to new DM messages
const sub1 = subscribeToMessages(conversationId, (newMsg) => {
  console.log("New message:", newMsg)
})

// Listen to new general chat posts
const sub2 = subscribeToGeneralChat((newPost) => {
  console.log("New post:", newPost)
})

// Clean up when done
sub1.unsubscribe()
sub2.unsubscribe()
```

### Get Notifications

```typescript
import { getNotifications, subscribeToNotifications } from '@/lib/db'

// Get all unread notifications
const unread = await getNotifications(false)

// Listen for new notifications
const sub = subscribeToNotifications((notification) => {
  // Play sound if enabled
  if (notification.type === 'dm') {
    playNotificationSound()
  }
})
```

### Update Profile

```typescript
import { updateProfile } from '@/lib/db'

await updateProfile({
  display_name: "New Name",
  bio: "My new bio",
  thema: "dark",
  notification_settings: { sound: true, desktop: true }
})
```

---

## 🔐 RLS Security (Automatic!)

Your app automatically respects these rules:

### Conversations & Messages
- Only participants can see/send
- Messages are private by default
- Soft delete (deleted_at field)
- Typing indicator only for participants

### General Chat & Forum
- Everyone can READ
- Only author can WRITE/EDIT/DELETE
- Admins can moderate

### Profiles
- Only your own profile visible
- Notifications are private
- Settings per user

### Moderation
- Reports visible only to author
- Whitelist is public readable
- Admins can see everything

---

## 🧪 Testing

### Test with Multiple Users

```bash
# Terminal 1: User A
open http://localhost:5173

# Terminal 2: User B (different browser/incognito)
open http://localhost:5173
```

### Create Test Data

```typescript
// In browser console of first user (A)
import { createConversation, sendMessage } from '@/lib/db'

// Get user B's ID from their profile
const conv = await createConversation(
  ["user-a-id", "user-b-id"],
  ["Alice", "Bob"],
  [null, null],
  "user-a-id"
)

// Send message
await sendMessage(conv.id, "user-a-id", "Hello Bob!")
```

### Verify RLS Works

```typescript
// Try to read someone else's profile (should fail)
const { data, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', 'other-user-id')

// error: Permission denied
```

---

## 🛠️ Advanced Usage

### Custom Queries with RLS

```typescript
import { supabase } from '@/lib/db'

// This query respects RLS automatically!
const { data } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', convId)

// If you're not a participant: empty result
// If you are: all non-deleted messages
```

### Batch Operations

```typescript
// Create multiple notifications
await Promise.all(
  userIds.map(id => 
    createNotification(id, 'mention', 'You were mentioned!', 'post', postId)
  )
)
```

### Error Handling

```typescript
try {
  await sendMessage(convId, userId, text)
} catch (error) {
  if (error.code === '42501') {
    // Permission denied - not a participant
    console.error('You cannot send to this conversation')
  } else {
    console.error('Error:', error)
  }
}
```

---

## 📝 File Structure

```
packages/web/src/
├── App.tsx                    ← Main app (already configured)
├── pages/
│   ├── Chat.tsx              ← Chat UI (fully implemented)
│   └── Login.tsx
├── hooks/
│   └── useAuth.ts
└── lib/
    ├── supabase.ts           ← Supabase client
    ├── db.ts                 ← All exports
    ├── db-conversations.ts   ← DMs
    ├── db-posts.ts          ← General chat
    ├── db-profiles.ts       ← Profiles/notifications
    ├── db-forum.ts          ← Forum
    ├── types.ts             ← TypeScript types
    └── README.md            ← API docs
```

---

## ⚡ Performance Tips

1. **Cache conversations list** - Don't refetch every render
2. **Use real-time subscriptions** - Don't poll for updates
3. **Pagination** - Add `limit` parameter to queries
4. **Batch notifications** - Group multiple creates together
5. **Index queries** - Check SUPABASE_SCHEMA.md for indexes

---

## 🐛 Troubleshooting

### "Permission denied" on messages
- Check you're a participant in the conversation
- Verify user ID is correct
- Reload page to refresh session

### Typing indicator not working
- Check real-time is enabled in Supabase
- Verify conversation ID is correct
- Check subscription is active

### Profile not updating
- Make sure you're updating your OWN profile
- RLS prevents updating others' profiles

### Real-time not updating
- Check browser console for subscription errors
- Verify subscriptions are active in DevTools
- Check Supabase > Database > Replication settings

---

## 🔄 Common Patterns

### Load conversation with messages
```typescript
const { conversation, messages } = await getConversation(convId)
```

### Create & send first message
```typescript
const conv = await createConversation([userId1, userId2], [name1, name2], [photo1, photo2], userId1)
await sendMessage(conv.id, userId1, "Hey!")
```

### Update typing status while typing
```typescript
const handleInputChange = (text) => {
  setInput(text)
  setTypingStatus(convId, userId, text.length > 0)
}
```

### Mark notifications as read
```typescript
const notifications = await getNotifications()
await Promise.all(
  notifications.map(n => markNotificationAsRead(n.id))
)
```

---

## ✅ Checklist

- [x] Database migrations applied
- [x] RLS policies active
- [x] Database services implemented
- [x] Chat UI created
- [x] Real-time subscriptions working
- [ ] Test with multiple users
- [ ] Performance testing
- [ ] Deploy to staging
- [ ] Deploy to production

---

## 📞 Support

- Check [lib/README.md](../../../packages/web/src/lib/README.md) for API docs
- Check [RLS_POLICIES_GUIDE.md](../../../RLS_POLICIES_GUIDE.md) for security details
- Check [SUPABASE_SCHEMA.md](../../../SUPABASE_SCHEMA.md) for schema details
- Check [SUPABASE_RLS_SETUP.md](../../../SUPABASE_RLS_SETUP.md) for setup steps

Veel succes! 🚀
