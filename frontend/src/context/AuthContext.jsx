import { createContext, useContext, useState, useEffect } from 'react';
import { getToken, saveToken, clearToken, authFetch } from '../utils/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token,            setToken]            = useState(getToken());
  const [userRole,         setUserRole]         = useState(null);
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [currentUserName,  setCurrentUserName]  = useState('');
  const [brandId,          setBrandId]          = useState(null);
  const [brandName,        setBrandName]        = useState('');

  useEffect(() => {
    if (!token) {
      setUserRole(null); setCurrentUserEmail(null); setCurrentUserName('');
      setBrandId(null); setBrandName('');
      return;
    }
    authFetch('/auth/me')
      .then(r => {
        if (r.status === 401) { clearToken(); setToken(null); return null; }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        if (d.email) {
          setUserRole(d.role);
          setCurrentUserEmail(d.email);
          setCurrentUserName(d.name || '');
          setBrandId(d.brand_id ?? null);
          setBrandName(d.brand_name || '');
        }
      })
      .catch(() => {});
  }, [token]);

  const login  = (t) => { saveToken(t); setToken(t); };
  const logout = ()  => { clearToken(); setToken(null); };

  const updateName = async (name) => {
    const res = await authFetch('/users/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    if (res.ok) setCurrentUserName(name);
    return res.ok;
  };

  return (
    <AuthContext.Provider value={{ token, userRole, currentUserEmail, currentUserName, brandId, brandName, login, logout, updateName }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
