import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAuthStore } from './hooks/useAuth';
import LoginPage from './pages/Login';
import ChatPage from './pages/Chat';
import './App.css';
function App() {
    const { user, loading, checkAuth } = useAuthStore();
    const [isInitialized, setIsInitialized] = useState(false);
    useEffect(() => {
        // Check if user is already logged in
        checkAuth().then(() => setIsInitialized(true));
    }, [checkAuth]);
    if (!isInitialized || loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-screen bg-gray-900", children: _jsx("div", { className: "text-white text-xl", children: "Loading..." }) }));
    }
    return user ? _jsx(ChatPage, {}) : _jsx(LoginPage, {});
}
export default App;
//# sourceMappingURL=App.js.map