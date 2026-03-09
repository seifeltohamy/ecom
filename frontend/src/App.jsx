import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { authFetch } from './utils/auth.js';
import { S } from './styles.js';

import Login       from './pages/Login.jsx';
import BrandPicker from './pages/BrandPicker.jsx';
import Home        from './pages/Home.jsx';
import Analytics   from './pages/Analytics.jsx';
import Cashflow    from './pages/Cashflow.jsx';
import BostaOrders from './pages/BostaOrders.jsx';
import Products     from './pages/Products.jsx';
import ProductsSold from './pages/ProductsSold.jsx';
import StockValue   from './pages/StockValue.jsx';
import Settings     from './pages/Settings.jsx';
import Users        from './pages/Users.jsx';

const pageMeta = {
  '/':           { title: 'Dashboard',       subtitle: 'Overview of your financial activity.' },
  '/analytics':  { title: 'Analytics',       subtitle: 'Money in/out totals and spend distribution.' },
  '/cashflow':   { title: 'Cashflow',        subtitle: 'Track your daily money in and money out.' },
  '/bosta':      { title: 'Bosta Orders',    subtitle: 'Upload a Bosta inventory export to generate a sales report by SKU.' },
  '/products':       { title: 'Products',        subtitle: 'Maintain your SKU name list for reports.' },
  '/products-sold':  { title: 'Products Sold',   subtitle: 'Monthly performance by product with profit tracking.' },
  '/stock-value':    { title: 'Stock Value',     subtitle: 'Live inventory from Bosta — current stock value by product.' },
  '/settings':       { title: 'Settings',        subtitle: 'Configure integrations and API keys.' },
  '/users':          { title: 'User Management', subtitle: 'Create and manage user accounts.' },
};

function SwitchBrandButton({ close }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSwitch() {
    close();
    const res = await authFetch('/auth/clear-brand', { method: 'POST' });
    if (res.ok) {
      const { access_token } = await res.json();
      login(access_token);
      navigate('/select-brand', { replace: true });
    }
  }

  return (
    <button
      onClick={handleSwitch}
      style={{
        background: 'none', border: 'none', color: 'var(--muted)',
        fontSize: '.7rem', cursor: 'pointer', padding: '0',
        textDecoration: 'underline',
      }}
    >
      Switch
    </button>
  );
}

function Layout() {
  const { userRole, currentUserEmail, currentUserName, brandName, logout } = useAuth();
  const location = useLocation();
  const meta = pageMeta[location.pathname] || { title: '', subtitle: '' };
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);

  const signOutBtn = (
    <button
      onClick={logout}
      style={{
        width: '100%', padding: '.5rem .75rem',
        background: 'none', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', color: 'var(--muted)',
        fontSize: '.82rem', cursor: 'pointer', textAlign: 'left',
        transition: 'border-color .15s, color .15s'
      }}
      onMouseEnter={e => { e.target.style.borderColor = 'var(--danger)'; e.target.style.color = 'var(--danger)'; }}
      onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--muted)'; }}
    >
      Sign out
    </button>
  );

  return (
    <div className="zen-layout">
      {/* Mobile top bar */}
      <div className="zen-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={S.logo}>HQ</div>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>EcomHQ</span>
        </div>
        <button
          onClick={() => setMenuOpen(o => !o)}
          style={{
            background: 'none', border: '1px solid var(--border2)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text)',
            width: 40, height: 40, fontSize: '1.2rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          aria-label="Toggle menu"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar overlay backdrop (mobile only) */}
      <div className={`zen-overlay${menuOpen ? ' open' : ''}`} onClick={close} />

      {/* Sidebar */}
      <aside className={`zen-sidebar${menuOpen ? ' open' : ''}`}>
        <div style={S.brand}>
          <div style={S.logo}>{currentUserName ? currentUserName[0].toUpperCase() : 'H'}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUserName || 'EcomHQ'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUserEmail}
            </div>
          </div>
        </div>

        {/* Brand badge */}
        {brandName && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '.4rem .6rem', marginBottom: '.25rem',
            background: 'var(--surface2)', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
          }}>
            <span style={{ fontSize: '.75rem', color: 'var(--accent)', fontWeight: 600, letterSpacing: '.03em' }}>
              {brandName}
            </span>
            {userRole === 'admin' && (
              <SwitchBrandButton close={close} />
            )}
          </div>
        )}

        <nav style={{ display: 'grid', gap: '.4rem' }}>
          <NavLink to="/"          end  style={({ isActive }) => S.navItem(isActive)} onClick={close}>Home</NavLink>
          <NavLink to="/analytics"      style={({ isActive }) => S.navItem(isActive)} onClick={close}>Analytics</NavLink>
          <NavLink to="/cashflow"       style={({ isActive }) => S.navItem(isActive)} onClick={close}>Cashflow</NavLink>
          <NavLink to="/bosta"          style={({ isActive }) => S.navItem(isActive)} onClick={close}>Bosta Orders</NavLink>
          <NavLink to="/products-sold"  style={({ isActive }) => S.navItem(isActive)} onClick={close}>Products Sold</NavLink>
          <NavLink to="/stock-value"    style={({ isActive }) => S.navItem(isActive)} onClick={close}>Stock Value</NavLink>
          <NavLink to="/products"       style={({ isActive }) => S.navItem(isActive)} onClick={close}>Products</NavLink>
          {userRole === 'admin' && (
            <NavLink to="/users"        style={({ isActive }) => S.navItem(isActive)} onClick={close}>Users</NavLink>
          )}
        </nav>

        <div style={{ marginTop: 'auto', display: 'grid', gap: '.4rem' }}>
          {userRole === 'admin' && (
            <NavLink to="/settings" style={({ isActive }) => S.navItem(isActive)} onClick={close}>⚙ Settings</NavLink>
          )}
          {signOutBtn}
        </div>
      </aside>

      {/* Main content */}
      <main className="zen-main">
        <header style={S.header}>
          <div>
            <h1 style={S.h1}>{meta.title}</h1>
            <p style={S.sub}>{meta.subtitle}</p>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute() {
  const { token, userRole, brandId } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (userRole === 'admin' && brandId === null) return <Navigate to="/select-brand" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/select-brand" element={<BrandPicker />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index          element={<Home />} />
              <Route path="analytics"  element={<Analytics />} />
              <Route path="cashflow"   element={<Cashflow />} />
              <Route path="bosta"      element={<BostaOrders />} />
              <Route path="products-sold" element={<ProductsSold />} />
              <Route path="products"     element={<Products />} />
              <Route path="stock-value"  element={<StockValue />} />
              <Route path="settings"     element={<Settings />} />
              <Route path="users"        element={<Users />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
