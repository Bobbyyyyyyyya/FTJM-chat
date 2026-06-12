/**
 * Type definitions for FTJM Chat Database
 * These types mirror your Supabase schema with RLS policies
 */
// ============================================================================
// CONSTANTS
// ============================================================================
export const ROLES = {
    USER: 'user',
    MOD: 'mod',
    ADMIN: 'admin',
};
export const NOTIFICATION_TYPES = {
    MENTION: 'mention',
    REPLY: 'reply',
    SYSTEM: 'system',
    DM: 'dm',
};
export const REPORT_STATUS = {
    OPEN: 'open',
    INVESTIGATING: 'investigating',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
};
export const REPORT_REASONS = [
    'spam',
    'harassment',
    'inappropriate',
    'abuse',
    'other',
];
export const THEMES = {
    DARK: 'dark',
    LIGHT: 'light',
};
//# sourceMappingURL=types.js.map