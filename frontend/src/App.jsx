import { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { S } from './styles.js';

import Login       from './pages/Login.jsx';
import Home        from './pages/Home.jsx';
import Analytics   from './pages/Analytics.jsx';
import Cashflow    from './pages/Cashflow.jsx';
import BostaOrders from './pages/BostaOrders.jsx';
import Products     from './pages/Products.jsx';
import ProductsSold from './pages/ProductsSold.jsx';
import Users        from './pages/Users.jsx';

const pageMeta = {
  '/':           { title: 'Dashboard',       subtitle: 'Overview of your financial activity.' },
  '/analytics':  { title: 'Analytics',       subtitle: 'Money in/out totals and spend distribution.' },
  '/cashflow':   { title: 'Cashflow',        subtitle: 'Track your daily money in and money out.' },
  '/bosta':      { title: 'Bosta Orders',    subtitle: 'Upload a Bosta inventory export to generate a sales report by SKU.' },
  '/products':       { title: 'Products',        subtitle: 'Maintain your SKU name list for reports.' },
  '/products-sold':  { title: 'Products Sold',   subtitle: 'Monthly performance by product with profit tracking.' },
  '/users':          { title: 'User Management', subtitle: 'Create and manage user accounts.' },
};

function Layout() {
  const { userRole, currentUserEmail, currentUserName, logout } = useAuth();
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
          <div style={S.logo}>Z</div>
          <span style={{ fontWeight: 700, fontSize: '1rem' }}>Zen Finance</span>
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
          <div style={S.logo}>{currentUserName ? currentUserName[0].toUpperCase() : 'Z'}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUserName || 'Zen Finance'}
            </div>
            <div style={{ color: 'var(--muted)', fontSize: '.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUserEmail}
            </div>
          </div>
        </div>

        <nav style={{ display: 'grid', gap: '.4rem' }}>
          <NavLink to="/"          end  style={({ isActive }) => S.navItem(isActive)} onClick={close}>Home</NavLink>
          <NavLink to="/analytics"      style={({ isActive }) => S.navItem(isActive)} onClick={close}>Analytics</NavLink>
          <NavLink to="/cashflow"       style={({ isActive }) => S.navItem(isActive)} onClick={close}>Cashflow</NavLink>
          <NavLink to="/bosta"          style={({ isActive }) => S.navItem(isActive)} onClick={close}>Bosta Orders</NavLink>
          <NavLink to="/products-sold"  style={({ isActive }) => S.navItem(isActive)} onClick={close}>Products Sold</NavLink>
          <NavLink to="/products"       style={({ isActive }) => S.navItem(isActive)} onClick={close}>Products</NavLink>
          {userRole === 'admin' && (
            <NavLink to="/users"        style={({ isActive }) => S.navItem(isActive)} onClick={close}>Users</NavLink>
          )}
        </nav>

        <div style={{ marginTop: 'auto' }}>{signOutBtn}</div>
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
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route index          element={<Home />} />
              <Route path="analytics"  element={<Analytics />} />
              <Route path="cashflow"   element={<Cashflow />} />
              <Route path="bosta"      element={<BostaOrders />} />
              <Route path="products-sold" element={<ProductsSold />} />
              <Route path="products"     element={<Products />} />
              <Route path="users"      element={<Users />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
