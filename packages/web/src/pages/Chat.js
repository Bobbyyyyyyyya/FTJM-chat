import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
import { getConversations, getConversation, sendMessage, setTypingStatus, getPosts, createPost, subscribeToMessages, subscribeToTypingStatus, subscribeToGeneralChat, getProfile, } from '@/lib/db';
import { encryptText, maybeDecryptText } from '@/lib/crypto';
function useTheme() {
    const [theme, setTheme] = useState(() => (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'light');
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);
    const toggle = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'));
    return { theme, toggle };
}
export default function ChatPage() {
    const { user, logout } = useAuthStore();
    const { theme, toggle: toggleTheme } = useTheme();
    const [conversations, setConversations] = useState([]);
    const [selectedConvId, setSelectedConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const [generalChat, setGeneralChat] = useState([]);
    const [activeTab, setActiveTab] = useState('dm');
    const [messageInput, setMessageInput] = useState('');
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [selectedConversationProfiles, setSelectedConversationProfiles] = useState({});
    const [profilePreview, setProfilePreview] = useState(null);
    const [profilesCache, setProfilesCache] = useState({});
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
    // Pre-load all profiles on startup
    useEffect(() => {
        const loadAllProfiles = async () => {
            const userIds = new Set();
            const convs = await getConversations();
            convs.forEach((c) => {
                const parts = Array.isArray(c.participants) ? c.participants : [];
                parts.forEach((id) => userIds.add(id));
            });
            const posts = await getPosts();
            posts.forEach((p) => userIds.add(p.author_id));
            const existing = new Set(Object.keys(profilesCache));
            const toFetch = [...userIds].filter((id) => !existing.has(id));
            await Promise.all(toFetch.map(async (uid) => {
                const p = await getProfile(uid);
                if (p)
                    setProfilesCache((prev) => ({ ...prev, [uid]: p }));
            }));
        };
        loadAllProfiles();
    }, []);
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
        // Pre-fetch profiles for general chat authors
        getPosts().then((posts) => {
            const authorIds = [...new Set(posts.map((p) => p.author_id))];
            authorIds.forEach(async (uid) => {
                if (!profilesCache[uid]) {
                    const p = await getProfile(uid);
                    if (p)
                        setProfilesCache((prev) => ({ ...prev, [uid]: p }));
                }
            });
        });
        const subscription = subscribeToGeneralChat((payload) => {
            if (payload.type === 'INSERT' && payload.new) {
                const newPost = payload.new;
                setGeneralChat((prev) => [newPost, ...prev]);
                if (!profilesCache[newPost.author_id]) {
                    getProfile(newPost.author_id).then((p) => {
                        if (p)
                            setProfilesCache((prev) => ({ ...prev, [newPost.author_id]: p }));
                    });
                }
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
    useEffect(() => {
        if (!selectedConvId || !user?.id)
            return;
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
                subscription = subscribeToMessages(selectedConvId, (payload) => {
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
                typingSub = subscribeToTypingStatus(selectedConvId, (users) => {
                    setTypingUsers(users.filter((t) => t.user_id !== user.id).map((t) => t.user_id));
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
        const participantNames = Array.isArray(selectedConversation.participant_names) ? selectedConversation.participant_names : [];
        const participantPhotos = Array.isArray(selectedConversation.participant_photos) ? selectedConversation.participant_photos : [];
        const participants = Array.isArray(selectedConversation.participants) ? selectedConversation.participants : [];
        const index = participants.findIndex((id) => id === userId);
        const display_name = participantNames[index] || (userId === user?.id ? 'You' : `User ${userId.slice(0, 6)}`);
        const photo_url = participantPhotos[index];
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
        const cached = profilesCache[userId];
        if (cached)
            return setFromProfile(cached);
        if (displayName || photoUrl) {
            setProfilePreview({
                id: userId,
                display_name: displayName || getParticipantInfo(userId).display_name,
                photo_url: photoUrl || getParticipantInfo(userId).photo_url,
                bio: undefined,
                isCurrentUser: userId === user?.id,
            });
        }
        getProfile(userId).then((p) => {
            if (p) {
                setProfilesCache((prev) => ({ ...prev, [userId]: p }));
                setFromProfile(p);
            }
        });
    };
    const closeProfile = () => setProfilePreview(null);
    const getConversationPreview = (conv) => {
        const convParticipants = Array.isArray(conv.participants) ? conv.participants : [];
        const convNames = Array.isArray(conv.participant_names) ? conv.participant_names : [];
        const convPhotos = Array.isArray(conv.participant_photos) ? conv.participant_photos : [];
        if (conv.is_group) {
            if (conv.title)
                return { display_name: conv.title, photo_url: undefined, isGroup: true };
            const others = convParticipants
                .map((id, i) => ({ id, name: convNames[i], photo: convPhotos[i] }))
                .filter((x) => x.id !== user?.id);
            const firstNames = others.map((x) => {
                const cached = profilesCache[x.id];
                return cached?.display_name || x.name || `User ${x.id.slice(0, 6)}`;
            });
            return {
                display_name: firstNames.slice(0, 3).join(', ') + (firstNames.length > 3 ? ` +${firstNames.length - 3}` : ''),
                photo_url: undefined,
                isGroup: true,
            };
        }
        const otherIndex = convParticipants.findIndex((id) => id !== user?.id);
        const otherId = otherIndex >= 0 ? convParticipants[otherIndex] : convParticipants[0];
        const cached = otherId ? profilesCache[otherId] : null;
        const display_name = cached?.display_name || convNames[otherIndex] || convNames[0] || 'Conversation';
        const photo_url = cached?.photo_url || convPhotos[otherIndex];
        return { display_name, photo_url, isGroup: false };
    };
    return (_jsxs("div", { className: "h-screen flex flex-col bg-body", children: [_jsxs("header", { className: "bg-surface border-b border-surface px-6 py-3 flex items-center justify-between shrink-0", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center shadow-sm", children: _jsx("span", { className: "text-base font-bold text-white", children: "F" }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-lg font-bold text-primary", children: "FTJM Chat" }), _jsx("p", { className: "text-[11px] text-muted", children: "Secure messaging" })] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2.5 bg-surface-muted rounded-xl px-3.5 py-2 border-subtle", children: [_jsx("div", { className: "h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-[10px] font-bold text-white", children: getAvatarInitials(user?.display_name || 'U') }), _jsx("span", { className: "text-sm font-medium text-primary", children: user?.display_name })] }), _jsx("button", { onClick: toggleTheme, className: "h-9 w-9 rounded-xl bg-surface-muted hover:bg-surface-hover flex items-center justify-center transition-all duration-200", "aria-label": "Toggle theme", children: theme === 'light' ? (_jsx("svg", { className: "w-4 h-4 text-secondary", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" }) })) : (_jsx("svg", { className: "w-4 h-4 text-yellow-400", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" }) })) }), _jsx("button", { onClick: logout, className: "px-4 py-2 bg-surface-muted hover:bg-surface-hover active:scale-95 text-secondary font-medium rounded-xl text-sm transition-all duration-200", children: "Logout" })] })] }), _jsxs("div", { className: "flex-1 flex overflow-hidden", children: [activeTab === 'dm' && (_jsxs("aside", { className: "w-72 bg-surface border-r border-surface flex flex-col shrink-0", children: [_jsx("div", { className: "px-5 pt-5 pb-3 border-b border-subtle", children: _jsxs("h2", { className: "text-base font-bold text-primary flex items-center gap-2", children: [_jsx("svg", { className: "w-5 h-5 text-secondary", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }), "Chats"] }) }), _jsx("div", { className: "flex-1 overflow-y-auto p-3 space-y-1", children: conversations.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center px-6", children: [_jsx("p", { className: "text-muted text-sm font-medium", children: "No conversations yet" }), _jsx("p", { className: "text-muted text-xs mt-1", children: "Start a new chat to begin" })] })) : (conversations.map((conv) => {
                                    const preview = getConversationPreview(conv);
                                    const isSelected = selectedConvId === conv.id;
                                    const isGroup = conv.is_group;
                                    return (_jsxs("button", { onClick: () => { setSelectedConvId(conv.id); setActiveTab('dm'); }, className: `sidebar-item ${isSelected ? 'sidebar-item-active' : 'sidebar-item-inactive'}`, children: [isGroup ? (_jsx("div", { className: `h-10 w-10 rounded-xl overflow-hidden flex items-center justify-center text-sm font-bold shrink-0 ${isSelected ? 'bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm text-white' : 'bg-amber-100 text-amber-600'}`, children: _jsx("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" }) }) })) : (_jsx("div", { className: `h-10 w-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white shrink-0 ${isSelected ? 'bg-gradient-to-br from-emerald-400 to-teal-400 shadow-sm' : 'bg-surface-hover text-secondary'}`, children: preview.photo_url ? (_jsx("img", { src: preview.photo_url, alt: preview.display_name, className: "h-full w-full object-cover" })) : (getAvatarInitials(preview.display_name)) })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: `text-sm font-semibold truncate ${isSelected ? '' : ''}`, children: preview.display_name }), _jsx("p", { className: `text-xs mt-0.5 ${isSelected ? (isGroup ? 'text-amber-600' : 'text-emerald-600') : ''}`, children: isGroup ? 'Group' : 'Direct message' })] })] }, conv.id));
                                })) })] })), _jsxs("main", { className: "flex-1 flex flex-col bg-body", children: [_jsxs("div", { className: "bg-surface border-b border-surface px-5 pt-4 pb-0 flex gap-2", children: [_jsxs("button", { onClick: () => setActiveTab('dm'), className: `tab-btn ${activeTab === 'dm' ? 'tab-btn-active' : 'tab-btn-inactive'}`, children: [_jsx("svg", { className: "w-4 h-4 inline mr-1.5 -mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }), "Messages"] }), _jsxs("button", { onClick: () => { setActiveTab('general'); setSelectedConvId(null); }, className: `tab-btn ${activeTab === 'general' ? 'tab-btn-active' : 'tab-btn-inactive'}`, children: [_jsx("svg", { className: "w-4 h-4 inline mr-1.5 -mt-0.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" }) }), "General"] })] }), _jsxs("div", { className: "bg-surface border-b border-subtle px-6 py-4 flex items-center justify-between gap-3", children: [activeTab === 'dm' && selectedConversation && (_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [selectedConversation.is_group && (_jsx("div", { className: "h-9 w-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shrink-0 shadow-sm", children: _jsx("svg", { className: "w-5 h-5 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" }) }) })), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm text-secondary", children: selectedConversation.is_group
                                                            ? (selectedConversation.title || 'Group')
                                                            : 'Direct message' }), _jsx("p", { className: "text-sm text-primary font-medium truncate", children: (Array.isArray(selectedConversation.participant_names) ? selectedConversation.participant_names : [])
                                                            .filter((name, idx) => (Array.isArray(selectedConversation.participants) ? selectedConversation.participants : [])[idx] !== user?.id)
                                                            .join(', ') })] })] })), activeTab === 'dm' && !selectedConversation && (_jsx("p", { className: "text-sm text-muted", children: "Select a conversation" })), activeTab === 'general' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm text-primary font-medium", children: "General Chat" }), _jsx("span", { className: "text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0", children: "Live room" })] }))] }), _jsx("div", { className: "flex-1 overflow-y-auto px-6 py-6 space-y-4", children: activeTab === 'dm' ? (selectedConvId ? (_jsxs(_Fragment, { children: [messages.length === 0 && (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center py-16", children: [_jsx("p", { className: "text-muted font-medium", children: "No messages yet" }), _jsx("p", { className: "text-muted text-sm mt-1", children: "Send the first message!" })] })), [...messages].reverse().map((msg) => {
                                            const isMine = msg.sender_id === user?.id;
                                            const participant = getParticipantInfo(msg.sender_id);
                                            const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                            return (_jsxs("div", { className: `flex gap-3 items-end ${isMine ? 'flex-row-reverse' : 'flex-row'}`, children: [!isMine && (_jsx("button", { onClick: () => openProfile(msg.sender_id, participant.display_name, participant.photo_url), className: "h-8 w-8 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 hover:ring-2 hover:ring-emerald-300 transition-all", children: participant.photo_url ? (_jsx("img", { src: participant.photo_url, alt: participant.display_name, className: "h-full w-full object-cover" })) : getAvatarInitials(participant.display_name) })), _jsxs("div", { className: `max-w-xl ${isMine ? 'chat-bubble-mine' : 'chat-bubble-other'} px-4 py-2.5`, children: [_jsx("div", { className: `flex items-center gap-2 mb-0.5 ${isMine ? 'flex-row-reverse' : ''}`, children: _jsx("span", { className: `text-[10px] font-semibold uppercase tracking-wider ${isMine ? 'text-emerald-100' : 'text-muted'}`, children: isMine ? 'You' : participant.display_name }) }), _jsx("p", { className: `whitespace-pre-line break-words text-sm leading-relaxed ${isMine ? 'text-white' : 'text-primary'}`, children: maybeDecryptText(msg.text, msg.is_encrypted) }), _jsx("p", { className: `text-[10px] mt-1 ${isMine ? 'text-emerald-200' : 'text-muted'}`, children: time })] }), isMine && (_jsx("button", { onClick: () => openProfile(msg.sender_id, user?.display_name ?? undefined, user?.photo_url ?? undefined), className: "h-8 w-8 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 hover:ring-2 hover:ring-emerald-300 transition-all", children: user?.photo_url ? (_jsx("img", { src: user.photo_url, alt: user.display_name ?? '', className: "h-full w-full object-cover" })) : getAvatarInitials(user?.display_name || 'You') }))] }, msg.id));
                                        }), typingUsers.length > 0 && (_jsxs("div", { className: "flex items-center gap-2 text-muted text-sm", children: [_jsxs("div", { className: "flex gap-1", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce", style: { animationDelay: '0ms' } }), _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce", style: { animationDelay: '150ms' } }), _jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce", style: { animationDelay: '300ms' } })] }), typingUsers.map((id) => getParticipantInfo(id).display_name).join(', '), " typing..."] }))] })) : (_jsxs("div", { className: "flex flex-col items-center justify-center h-full", children: [_jsx("p", { className: "text-muted text-lg font-medium", children: "Select a conversation" }), _jsx("p", { className: "text-muted text-sm mt-1", children: "Choose a chat from the sidebar" })] }))) : (_jsx("div", { className: "space-y-4", children: generalChat.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-full text-center py-20", children: [_jsx("p", { className: "text-muted text-lg font-medium", children: "No messages yet" }), _jsx("p", { className: "text-muted text-sm mt-1", children: "Be the first to post in general chat" })] })) : (generalChat.map((post) => {
                                        const isMine = post.author_id === user?.id;
                                        const authorName = isMine ? 'You' : `User ${post.author_id.slice(0, 6)}`;
                                        return (_jsxs("div", { className: "chat-bubble-other !rounded-3xl p-5", children: [_jsxs("div", { className: "flex items-center gap-3 mb-3", children: [_jsx("button", { onClick: () => openProfile(post.author_id, authorName), className: "h-9 w-9 rounded-full overflow-hidden bg-surface-hover flex items-center justify-center text-xs font-bold text-secondary shrink-0 hover:ring-2 hover:ring-emerald-300 transition-all", children: getAvatarInitials(authorName) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-semibold text-primary", children: authorName }), _jsx("p", { className: "text-[11px] text-muted", children: new Date(post.created_at).toLocaleString() })] })] }), _jsx("p", { className: "text-primary whitespace-pre-line break-words text-sm leading-relaxed", children: maybeDecryptText(post.content) })] }, post.id));
                                    })) })) }), _jsx("div", { className: "bg-surface border-t border-surface px-6 py-4", children: _jsxs("div", { className: "flex gap-3 max-w-4xl mx-auto", children: [_jsx("input", { type: "text", placeholder: activeTab === 'dm' ? (selectedConvId ? 'Type a message...' : 'Select a conversation first') : 'Share something with everyone...', value: messageInput, onChange: (e) => { setMessageInput(e.target.value); if (activeTab === 'dm')
                                                handleTyping(e.target.value.length > 0); }, onKeyPress: (e) => { if (e.key === 'Enter')
                                                activeTab === 'dm' ? handleSendMessage() : handleSendPost(); }, className: "input-field", disabled: activeTab === 'dm' && !selectedConvId }), _jsxs("button", { onClick: activeTab === 'dm' ? handleSendMessage : handleSendPost, disabled: activeTab === 'dm' && !selectedConvId, className: "btn-send", children: [_jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 19V5m0 0l-7 7m7-7l7 7" }) }), "Send"] })] }) })] })] }), profilePreview && (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/20 dark:bg-black/40 backdrop-blur-sm", onClick: closeProfile, children: _jsxs("div", { className: "w-full max-w-sm bg-surface rounded-3xl shadow-xl shadow-black/10 dark:shadow-black/50 p-7 border border-subtle", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("div", { className: "h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-2xl font-bold text-white shadow-sm", children: profilePreview.photo_url ? (_jsx("img", { src: profilePreview.photo_url, alt: profilePreview.display_name, className: "h-full w-full object-cover" })) : getAvatarInitials(profilePreview.display_name) }), _jsxs("div", { children: [_jsx("p", { className: "text-lg font-bold text-primary", children: profilePreview.display_name }), _jsx("span", { className: `text-xs px-2.5 py-1 rounded-full font-medium inline-block mt-1 ${profilePreview.isCurrentUser ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-surface-muted text-secondary'}`, children: profilePreview.isCurrentUser ? 'You' : 'User' })] })] }), _jsx("button", { onClick: closeProfile, className: "rounded-xl bg-surface-muted p-2 text-muted hover:bg-surface-hover hover:text-secondary transition-all", children: _jsx("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), _jsxs("div", { className: "mt-5 pt-5 border-t border-subtle", children: [_jsx("p", { className: "text-sm text-secondary leading-relaxed", children: profilePreview.bio || _jsx("span", { className: "text-muted italic", children: "No profile bio available." }) }), !profilePreview.isCurrentUser && (_jsxs("p", { className: "text-xs text-muted flex items-center gap-2 mt-3", children: [_jsx("svg", { className: "w-3.5 h-3.5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }), "Private profile \u2014 limited info available."] }))] })] }) }))] }));
}
//# sourceMappingURL=Chat.js.map