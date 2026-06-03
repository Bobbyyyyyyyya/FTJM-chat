# Database Services Guide

Je app gebruikt nu database service modules die correct werken met de Supabase RLS policies.

## 📁 Bestanden

### `src/lib/db.ts` (Main export)
- Exporteert alle database services
- Bevat RLS policy reference (commentaar voor developers)
- Helper functies om permissions te checken

### `src/lib/db-conversations.ts` (DM Management)
Functie voor directe berichten (1-op-1 en groepen):

```typescript
// Conversations
getConversations()           // Get all DM conversations
getConversation(id)          // Get one DM with messages
createConversation(...)      // Create new DM group
subscribeToMessages()        // Real-time new messages
subscribeToTypingStatus()    // Real-time typing indicator

// Messages
sendMessage(convId, senderId, text)
deleteMessage(msgId)         // Soft delete
setTypingStatus(convId, userId, isTyping)
getTypingStatus(convId)
```

### `src/lib/db-posts.ts` (General Chat)
Functies voor publieke berichten die iedereen ziet:

```typescript
getPosts(limit)              // Get all posts
getPostsByAuthor(authorId)   // Get posts by user
createPost(authorId, title, content)
updatePost(postId, title, content)
deletePost(postId)
subscribeToGeneralChat()     // Real-time updates
```

### `src/lib/db-profiles.ts` (Profiles & Notifications)
Gebruikersprofiel en meldingen:

```typescript
// Profile (eigen profiel management)
getCurrentProfile()          // Get own profile
updateProfile(updates)       // Update eigen profile
  - display_name
  - bio
  - photo_url
  - notification_settings ({"sound": bool, "desktop": bool})
  - thema ('dark' | 'light')

// Notifications (Geluid/alerts)
getNotifications(isRead?)    // Get notifications
createNotification(...)      // Alert aan user
markNotificationAsRead(id)
subscribeToNotifications()   // Real-time alerts

// Nicknames (@mentions)
getNickname(userId)
setNickname(userId, nickname)
getAllNicknames()            // Voor autocomplete
```

### `src/lib/db-forum.ts` (Forum/Discussions)
Openbare discussie threads en reacties:

```typescript
// Threads
getForumThreads(category?, limit)
getForumThread(threadId)     // With comments
createForumThread(authorId, title, content, category)
updateForumThread(threadId, title, content)
deleteForumThread(threadId)

// Comments
postForumComment(threadId, authorId, content)
updateForumComment(commentId, content)
deleteForumComment(commentId, threadId)
subscribeToForumThread()     // Real-time comments
```

---

## 🔐 RLS Security (Automatisch)

Je hoeft niks handmatig in te stellen - RLS policies doen het automatisch!

### Wie kan wat zien:

| Tabel | Who Can See | Notes |
|-------|-----------|-------|
| `profiles` | Alleen jezelf | Private profiel |
| `posts` | Iedereen | Public general chat |
| `conversations` | Participants | Private DMs |
| `messages` | Participants | Private DM messages |
| `forum_threads` | Iedereen | Public discussions |
| `forum_comments` | Iedereen | Public replies |
| `notifications` | Alleen jezelf | Private alerts |
| `typing` | Participants | Live typing indicator |

### Error Handling

```typescript
try {
  await sendMessage(convId, userId, text)
} catch (error) {
  // RLS denied: je bent niet participant
  // In dat geval krijg je een 403 Unauthorized
}
```

---

## 💬 Praktijk Voorbeelden

### Verstuur een DM

```typescript
import { createConversation, sendMessage } from '@/lib/db'

// 1. Maak conversation aan met deelnemer(s)
const conv = await createConversation(
  [currentUserId, friendUserId],           // participants
  [currentUserName, friendName],           // display names
  [currentUserPhoto, friendPhoto],         // photos
  currentUserId                             // created_by
)

// 2. Verstuur bericht
await sendMessage(conv.id, currentUserId, 'Hallo!')
```

### Post iets in General Chat

```typescript
import { createPost } from '@/lib/db'

await createPost(
  userId,
  'My Title',
  'This is visible to everyone!'
)
```

### Subscribe to Real-Time Updates

```typescript
import { subscribeToMessages } from '@/lib/db'

const subscription = subscribeToMessages(conversationId, (newMessage) => {
  console.log('Nieuw bericht:', newMessage)
  // Update UI
})

// Stop listening
subscription.unsubscribe()
```

### Get Notifications

```typescript
import { subscribeToNotifications } from '@/lib/db'

const subscription = subscribeToNotifications((notification) => {
  // Play sound if settings allow
  if (currentUser.notification_settings.sound) {
    playNotificationSound()
  }
  
  // Show notification
  showNotificationBadge(notification)
})
```

---

## 🧪 Testing

### Locaal testen met RLS

```sql
-- In Supabase SQL Editor, pretend to be user A:
set request.jwt.claims = '{"sub": "user-id-a"}';

-- Try to send message
select * from messages;

-- Try to update own profile
update profiles set display_name = 'New Name' where id = 'user-id-a';

-- Try to access someone else's profile (should fail):
set request.jwt.claims = '{"sub": "user-id-b"}';
update profiles set display_name = 'Hack' where id = 'user-id-a';
-- ❌ Permission denied!
```

---

## 🐛 Debugging

### "Permission Denied" Error

1. Check je RLS policies zijn actief in Supabase
2. Verify je user ID is correct
3. Check dat de query voldoet aan policy voorwaarden

### Real-time Updates Werken Niet

1. Zorg dat je `subscribeToX()` function oproept
2. Check dat Realtime is enabled in Supabase > Database > Replication
3. Monitor subscriptions in browser DevTools

### Slow Queries

1. Check indexes in SUPABASE_SCHEMA.md
2. Profile met `explain analyze` in SQL Editor
3. Avoid N+1 queries - batch operations

---

## 📝 Best Practices

✅ **DO:**
- Always use the service functions, don't call Supabase directly
- Handle errors properly
- Subscribe for real-time features
- Test with multiple users
- Check RLS policies before adding new operations

❌ **DON'T:**
- Bypass RLS (use admin key client)
- Store sensitive data in public tables
- Make N+1 queries in loops
- Forget to unsubscribe from listeners
- Trust client-side validation alone

---

## 🔄 Migration from Raw Queries

**Old:**
```typescript
const { data } = await supabase
  .from('conversations')
  .select('*')
```

**New:**
```typescript
import { getConversations } from '@/lib/db'
const conversations = await getConversations()
```

Benefits:
- ✅ Type-safe
- ✅ Error handling included
- ✅ Consistent naming
- ✅ Easier to maintain

