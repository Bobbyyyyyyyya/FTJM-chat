import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useAuthStore } from '@/hooks/useAuth';
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSignup, setIsSignup] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const { login, signup } = useAuthStore();
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            if (isSignup) {
                await signup(email, password, displayName);
            }
            else {
                await login(email, password);
            }
        }
        catch (err) {
            setError(err.message || 'An error occurred');
        }
        finally {
            setIsLoading(false);
        }
    };
    return (_jsx("div", { className: "min-h-screen bg-slate-900 flex items-center justify-center p-4", children: _jsxs("div", { className: "bg-slate-800 rounded-lg shadow-xl p-8 w-full max-w-md", children: [_jsx("h1", { className: "text-3xl font-bold text-white mb-2", children: "FTJM Chat" }), _jsx("p", { className: "text-slate-400 mb-8", children: isSignup ? 'Create an account' : 'Welcome back' }), error && (_jsx("div", { className: "bg-red-900 text-red-100 p-3 rounded mb-4", children: error })), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [isSignup && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-300 mb-1", children: "Display Name" }), _jsx("input", { type: "text", value: displayName, onChange: (e) => setDisplayName(e.target.value), className: "w-full bg-slate-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500", required: true })] })), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-300 mb-1", children: "Email" }), _jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value), className: "w-full bg-slate-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500", required: true })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-slate-300 mb-1", children: "Password" }), _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), className: "w-full bg-slate-700 text-white rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500", required: true })] }), _jsx("button", { type: "submit", disabled: isLoading, className: "w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white font-medium py-2 rounded transition-colors", children: isLoading ? 'Loading...' : isSignup ? 'Sign Up' : 'Login' })] }), _jsx("button", { type: "button", onClick: () => setIsSignup(!isSignup), className: "w-full mt-4 text-slate-400 hover:text-slate-200 text-sm", children: isSignup
                        ? 'Already have an account? Login'
                        : "Don't have an account? Sign up" })] }) }));
}
//# sourceMappingURL=Login.js.map