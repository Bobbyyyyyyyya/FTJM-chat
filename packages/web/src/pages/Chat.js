import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import { getConversations, getConversation, sendMessage, setTypingStatus, getPosts, createPost, subscribeToMessages, subscribeToTypingStatus, subscribeToGeneralChat, getProfile, } from '@/lib/db';
import { encryptText, maybeDecryptText } from '@/lib/crypto';
export default function ChatPage() {
    const { user, logout } = useAuthStore();
    // State for conversations (DMs)
    const [conversations, setConversations] = useState([]);
    const [selectedConvId, setSelectedConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    // State for general chat (Posts)
    const [generalChat, setGeneralChat] = useState([]);
    const [activeTab, setActiveTab] = useState('dm');
    // Message input
    const [messageInput, setMessageInput] = useState('');
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [selectedConversationProfiles, setSelectedConversationProfiles] = useState({});
    const [profilePreview, setProfilePreview] = useState(null);
    const [profilesCache, setProfilesCache] = useState({});
    // Load conversations on mount
    useEffect(() => {
        const loadConversations = async () => {
            try {
                const convs = await getConversations();
                setConversations(convs);
            }
            catch (error) {
                console.error('Error loading conversations:', error);
            }
        };
        loadConversations();
    }, []);
    // Load general chat posts on mount
    useEffect(() => {
        const loadPosts = async () => {
            try {
                const posts = await getPosts();
                setGeneralChat(posts);
            }
            catch (error) {
                console.error('Error loading posts:', error);
            }
        };
        loadPosts();
        // Subscribe to real-time updates
        const subscription = subscribeToGeneralChat((payload) => {
            if (payload.type === 'INSERT' && payload.new) {
                setGeneralChat((prev) => [payload.new, ...prev]);
            }
            else if (payload.type === 'UPDATE' && payload.new) {
                setGeneralChat((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)));
            }
            else if (payload.type === 'DELETE' && payload.old) {
                setGeneralChat((prev) => prev.filter((p) => p.id !== payload.old.id));
            }
        });
        return () => {
            subscription.unsubscribe();
        };
    }, []);
    // Load messages for selected conversation
    useEffect(() => {
        console.log('[Chat] message useEffect start', {
            selectedConvId,
            userId: user?.id,
        });
        if (!selectedConvId || !user?.id) {
            console.log('[Chat] message useEffect skipped', {
                selectedConvId,
                userId: user?.id,
            });
            return;
        }
        let subscription = null;
        let typingSub = null;
        let isActive = true;
        const loadMessages = async () => {
            try {
                const { conversation, messages: msgs } = await getConversation(selectedConvId);
                if (!isActive)
                    return;
                setSelectedConversation(conversation);
                setMessages(msgs);
                // Pre-fetch participant profiles for accurate names/photos
                try {
                    const participants = conversation.participants || [];
                    await Promise.all(participants.map(async (uid) => {
                        if (!profilesCache[uid]) {
                            const p = await getProfile(uid);
                            if (p)
                                setProfilesCache((prev) => ({ ...prev, [uid]: p }));
                        }
                    }));
                }
                catch (e) {
                    console.warn('Error prefetching participant profiles', e);
                }
                // Subscribe to new messages and updates
                console.log('[Chat] subscribeToMessages called', {
                    selectedConvId,
                    userId: user?.id,
                });
                subscription = subscribeToMessages(selectedConvId, (payload) => {
                    console.debug('[Chat] realtime message event', {
                        selectedConvId,
                        type: payload.type,
                        messageId: payload.new?.id ?? payload.old?.id,
                        hasNew: Boolean(payload.new),
                        hasOld: Boolean(payload.old),
                    });
                    if (payload.type === 'INSERT' && payload.new) {
                        setMessages((prev) => [...prev, payload.new]);
                    }
                    else if (payload.type === 'UPDATE' && payload.new) {
                        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
                    }
                    else if (payload.type === 'DELETE' && payload.old) {
                        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
                    }
                });
                // Subscribe to typing status
                typingSub = subscribeToTypingStatus(selectedConvId, (users) => {
                    setTypingUsers(users
                        .filter((t) => t.user_id !== user.id)
                        .map((t) => t.user_id));
                });
                if (!isActive) {
                    subscription?.unsubscribe();
                    typingSub?.unsubscribe();
                }
            }
            catch (error) {
                console.error('Error loading messages:', error);
            }
        };
        loadMessages();
        return () => {
            isActive = false;
            subscription?.unsubscribe();
            typingSub?.unsubscribe();
        };
    }, [selectedConvId, user?.id]);
    // Handle sending message
    const handleSendMessage = async () => {
        if (!messageInput.trim() || !selectedConvId || !user?.id)
            return;
        try {
            const encryptedText = encryptText(messageInput);
            const newMessage = await sendMessage(selectedConvId, user.id, encryptedText, true);
            setMessages((prev) => [...prev, newMessage]);
            setMessageInput('');
            setIsTyping(false);
            await setTypingStatus(selectedConvId, user.id, false);
        }
        catch (error) {
            console.error('Error sending message:', error);
        }
    };
    // Handle sending post to general chat
    const handleSendPost = async () => {
        if (!messageInput.trim() || !user?.id)
            return;
        try {
            const encryptedContent = encryptText(messageInput);
            const newPost = await createPost(user.id, encryptedContent);
            setGeneralChat((prev) => [newPost, ...prev]);
            setMessageInput('');
        }
        catch (error) {
            console.error('Error sending post:', error);
        }
    };
    // Handle typing indicator
    const handleTyping = async (typing) => {
        if (!selectedConvId || !user?.id)
            return;
        setIsTyping(typing);
        try {
            await setTypingStatus(selectedConvId, user.id, typing);
        }
        catch (error) {
            console.error('Error updating typing status:', error);
        }
    };
    const getAvatarInitials = (value) => {
        const words = value.split(' ').filter(Boolean);
        if (words.length === 0)
            return 'U';
        if (words.length === 1)
            return words[0].slice(0, 2).toUpperCase();
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
    };
    const getParticipantInfo = (userId) => {
        // Prefer cached profile if available
        const p = profilesCache[userId] || selectedConversationProfiles[userId];
        if (p) {
            return {
                display_name: p.display_name || p.original_name || (userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`),
                photo_url: p.photo_url,
            };
        }
        if (!selectedConversation) {
            return {
                display_name: userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`,
                photo_url: undefined,
            };
        }
        const index = selectedConversation.participants.findIndex((id) => id === userId);
        const display_name = selectedConversation.participant_names[index] ||
            (userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`);
        const photo_url = selectedConversation.participant_photos[index];
        return { display_name, photo_url };
    };
    const openProfile = (userId, displayName, photoUrl) => {
        const setFromProfile = (p) => setProfilePreview({
            id: userId,
            display_name: p?.display_name || displayName || getParticipantInfo(userId).display_name,
            photo_url: p?.photo_url || photoUrl || getParticipantInfo(userId).photo_url,
            bio: p?.bio,
            isCurrentUser: userId === user?.id,
        });
        // If we already have cached profile, use it
        const cached = profilesCache[userId];
        if (cached)
            return setFromProfile(cached);
        // If displayName/photoUrl provided, show provisional and fetch full profile in background
        if (displayName || photoUrl) {
            setProfilePreview({
                id: userId,
                display_name: displayName || getParticipantInfo(userId).display_name,
                photo_url: photoUrl || getParticipantInfo(userId).photo_url,
                bio: undefined,
                isCurrentUser: userId === user?.id,
            });
        }
        // Fetch profile from backend and cache
        getProfile(userId).then((p) => {
            if (p) {
                setProfilesCache((prev) => ({ ...prev, [userId]: p }));
                setFromProfile(p);
            }
        });
    };
    const closeProfile = () => setProfilePreview(null);
    const getConversationPreview = (conv) => {
        const otherIndex = conv.participants.findIndex((id) => id !== user?.id);
        const display_name = conv.participant_names[otherIndex] || conv.participant_names[0] || 'Conversation';
        const photo_url = conv.participant_photos[otherIndex];
        return { display_name, photo_url };
    };
    return (_jsxs("div", { className: "h-screen bg-slate-900 flex flex-col", children: [_jsxs("div", { className: "bg-slate-800 border-b border-slate-700 p-4 flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold text-white", children: "FTJM Chat" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx("span", { className: "text-slate-300", children: user?.display_name }), _jsx("button", { onClick: logout, className: "px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors", children: "Logout" })] })] }), _jsxs("div", { className: "flex-1 flex overflow-hidden", children: [_jsxs("div", { className: "w-72 bg-slate-800 border-r border-slate-700 p-4 flex flex-col", children: [_jsx("h2", { className: "text-xl font-semibold text-white mb-4", children: "\uD83D\uDCAC Conversations" }), _jsx("div", { className: "flex-1 space-y-3 overflow-y-auto", children: conversations.length === 0 ? (_jsx("p", { className: "text-slate-400 text-sm", children: "No conversations yet" })) : (conversations.map((conv) => {
                                    const preview = getConversationPreview(conv);
                                    return (_jsx("button", { onClick: () => {
                                            setSelectedConvId(conv.id);
                                            setActiveTab('dm');
                                        }, className: `w-full text-left rounded-2xl p-3 transition-colors border border-slate-700 ${selectedConvId === conv.id
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10'
                                            : 'bg-slate-900 text-slate-300 hover:bg-slate-700'}`, children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-10 w-10 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-sm font-semibold text-white", children: preview.photo_url ? (_jsx("img", { src: preview.photo_url, alt: preview.display_name, className: "h-full w-full object-cover" })) : (getAvatarInitials(preview.display_name)) }), _jsxs("div", { className: "text-left", children: [_jsx("p", { className: "font-semibold", children: preview.display_name }), _jsx("p", { className: "text-xs text-slate-400", children: conv.is_group ? 'Group chat' : 'Direct message' })] })] }) }, conv.id));
                                })) })] }), _jsxs("div", { className: "flex-1 flex flex-col", children: [_jsxs("div", { className: "bg-slate-800 border-b border-slate-700 flex", children: [_jsx("button", { onClick: () => setActiveTab('dm'), className: `flex-1 py-3 font-semibold transition-colors ${activeTab === 'dm'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'}`, children: "\uD83D\uDCAC Messages" }), _jsx("button", { onClick: () => {
                                            setActiveTab('general');
                                            setSelectedConvId(null);
                                        }, className: `flex-1 py-3 font-semibold transition-colors ${activeTab === 'general'
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:text-white'}`, children: "\uD83D\uDCE2 General" })] }), _jsxs("div", { className: "bg-slate-950/80 border-b border-slate-700 p-4 flex items-center justify-between gap-4", children: [_jsx("div", { children: _jsx("p", { className: "text-sm text-slate-400", children: activeTab === 'dm'
                                                ? selectedConversation
                                                    ? `Conversation with ${selectedConversation.participant_names
                                                        .filter((name, idx) => selectedConversation.participants[idx] !== user?.id)
                                                        .join(', ')}`
                                                    : 'Select a conversation to start messaging'
                                                : 'General chat — everyone can see this room.' }) }), activeTab === 'general' && (_jsx("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-500", children: "Live room" }))] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-3", children: activeTab === 'dm' ? (selectedConvId ? (_jsxs(_Fragment, { children: [messages.map((msg) => {
                                            const isMine = msg.sender_id === user?.id;
                                            const participant = getParticipantInfo(msg.sender_id);
                                            return (_jsxs("div", { className: `flex gap-3 ${isMine ? 'justify-end' : 'justify-start'}`, children: [!isMine && (_jsx("button", { type: "button", onClick: () => openProfile(msg.sender_id, participant.display_name, participant.photo_url), className: "h-12 w-12 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700 hover:ring-blue-400 transition-all", children: participant.photo_url ? (_jsx("img", { src: participant.photo_url, alt: participant.display_name, className: "h-full w-full object-cover" })) : (_jsx("span", { className: "flex h-full w-full items-center justify-center text-sm font-semibold text-white", children: getAvatarInitials(participant.display_name) })) })), _jsxs("div", { className: `max-w-xl rounded-3xl p-4 shadow-sm ${isMine
                                                            ? 'bg-blue-600 text-white shadow-blue-500/20'
                                                            : 'bg-slate-700 text-slate-100 shadow-black/10'}`, children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: isMine ? 'You' : participant.display_name }), _jsx("span", { className: "text-xs text-slate-500", children: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })] }), _jsx("p", { className: "whitespace-pre-line break-words text-sm", children: maybeDecryptText(msg.text, msg.is_encrypted) })] }), isMine && (_jsx("button", { type: "button", onClick: () => openProfile(msg.sender_id, user?.display_name ?? undefined, user?.photo_url ?? undefined), className: "h-12 w-12 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700 hover:ring-blue-400 transition-all", children: user?.photo_url ? (_jsx("img", { src: user.photo_url, alt: user.display_name ?? '', className: "h-full w-full object-cover" })) : (_jsx("span", { className: "flex h-full w-full items-center justify-center text-sm font-semibold text-white", children: getAvatarInitials(user?.display_name || 'You') })) }))] }, msg.id));
                                        }), typingUsers.length > 0 && (_jsxs("div", { className: "text-slate-400 text-sm italic", children: [typingUsers
                                                    .map((id) => getParticipantInfo(id).display_name)
                                                    .join(', '), ' ', "is typing..."] }))] })) : (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("p", { className: "text-slate-400", children: "Select a conversation" }) }))) : (_jsx("div", { className: "space-y-4", children: generalChat.map((post) => {
                                        const isMine = post.author_id === user?.id;
                                        const authorName = isMine ? 'You' : `User ${post.author_id.slice(0, 6)}`;
                                        return (_jsxs("div", { className: "bg-slate-800 rounded-3xl p-4 shadow-sm shadow-black/20", children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("button", { type: "button", onClick: () => openProfile(post.author_id, authorName), className: "h-11 w-11 rounded-full overflow-hidden bg-slate-700 ring-2 ring-slate-700 hover:ring-blue-400 transition-all", children: _jsx("span", { className: "flex h-full w-full items-center justify-center text-sm font-semibold text-white", children: getAvatarInitials(authorName) }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-white", children: authorName }), _jsx("p", { className: "text-xs text-slate-400", children: new Date(post.created_at).toLocaleString() })] })] }), _jsx("p", { className: "text-slate-200 whitespace-pre-line break-words text-sm", children: maybeDecryptText(post.content) })] }, post.id));
                                    }) })) }), _jsx("div", { className: "border-t border-slate-700 p-4", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "text", placeholder: activeTab === 'dm'
                                                ? 'Type a message...'
                                                : 'Share in general chat...', value: messageInput, onChange: (e) => {
                                                setMessageInput(e.target.value);
                                                if (activeTab === 'dm') {
                                                    handleTyping(e.target.value.length > 0);
                                                }
                                            }, onKeyPress: (e) => {
                                                if (e.key === 'Enter') {
                                                    activeTab === 'dm'
                                                        ? handleSendMessage()
                                                        : handleSendPost();
                                                }
                                            }, className: "flex-1 bg-slate-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500", disabled: activeTab === 'dm' && !selectedConvId }), _jsx("button", { onClick: activeTab === 'dm'
                                                ? handleSendMessage
                                                : handleSendPost, disabled: activeTab === 'dm' && !selectedConvId, className: "px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded transition-colors", children: "Send" })] }) })] })] }), profilePreview && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6", children: _jsxs("div", { className: "w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700 p-6 shadow-2xl shadow-black/50", children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "h-16 w-16 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center text-2xl font-bold text-white", children: profilePreview.photo_url ? (_jsx("img", { src: profilePreview.photo_url, alt: profilePreview.display_name, className: "h-full w-full object-cover" })) : (getAvatarInitials(profilePreview.display_name)) }), _jsxs("div", { children: [_jsx("p", { className: "text-xl font-semibold text-white", children: profilePreview.display_name }), _jsx("p", { className: "text-sm text-slate-400", children: profilePreview.isCurrentUser ? 'Your profile' : 'User profile' })] })] }), _jsx("button", { type: "button", onClick: closeProfile, className: "rounded-full bg-slate-800 p-2 text-slate-300 hover:bg-slate-700", children: "\u2715" })] }), _jsxs("div", { className: "mt-5 space-y-3 text-sm text-slate-300", children: [_jsx("p", { children: profilePreview.bio || 'No profile bio available.' }), !profilePreview.isCurrentUser && (_jsx("p", { className: "text-slate-500", children: "This profile is private and only limited info is available." }))] })] }) }))] }));
}
//# sourceMappingURL=Chat.js.map