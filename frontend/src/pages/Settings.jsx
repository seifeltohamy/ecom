import { useState, useEffect } from 'react';
import { authFetch } from '../utils/auth.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDialog } from '../utils/useDialog.js';
import Card, { CardTitle } from '../components/Card.jsx';
import Btn from '../components/Btn.jsx';
import Alert from '../components/Alert.jsx';
import Dialog from '../components/Dialog.jsx';

const inputStyle = {
  flex: 1,
  background: 'var(--surface)', border: '1px solid var(--border)',
  color: 'var(--text)', borderRadius: 'var(--radius-sm)',
  padding: '.5rem .75rem', fontSize: '.9rem', outline: 'none',
};

const labelStyle = {
  display: 'block', marginBottom: '.5rem',
  fontSize: '.85rem', color: 'var(--muted)', fontWeight: 600,
};

const HOURS   = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function TimePicker({ value, onChange, disabled }) {
  const [h, m] = (value || '09:00').split(':');
  return (
    <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
      <select
        value={h}
        onChange={e => onChange(`${e.target.value}:${m}`)}
        disabled={disabled}
        style={{ ...inputStyle, flex: 'none', width: 70 }}
      >
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span style={{ color: 'var(--muted)' }}>:</span>
      <select
        value={m}
        onChange={e => onChange(`${h}:${e.target.value}`)}
        disabled={disabled}
        style={{ ...inputStyle, flex: 'none', width: 70 }}
      >
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
      <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>UTC</span>
    </div>
  );
}

export default function Settings() {
  const { brandName } = useAuth();
  const { dialogProps, confirm } = useDialog();

  // Bosta credentials
  const [apiKey,              setApiKey]              = useState('');
  const [bostaEmail,          setBostaEmail]          = useState('');
  const [bostaPassword,       setBostaPassword]       = useState('');
  const [bostaEmailPassword,  setBostaEmailPassword]  = useState('');
  const [showKey,             setShowKey]             = useState(false);
  const [showPass,            setShowPass]            = useState(false);
  const [showEmailPass,       setShowEmailPass]       = useState(false);
  const [payoutDays,          setPayoutDays]          = useState('2');

  // Stock alert config
  const [alertEnabled,  setAlertEnabled]  = useState(true);
  const [alertTime1,    setAlertTime1]    = useState('09:00');
  const [alertTime2,    setAlertTime2]    = useState('18:00');
  const [alertTime2On,  setAlertTime2On]  = useState(true);
  const [alertDays,     setAlertDays]     = useState('30');

  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(false);
  const [savingAlert,       setSavingAlert]        = useState(false);
  const [testingStock,      setTestingStock]       = useState(false);
  const [testingMeta,       setTestingMeta]        = useState(false);
  const [msg,               setMsg]               = useState(null);

  // Meta Ads
  const [metaConnected,     setMetaConnected]     = useState(false);
  const [metaConnectedName, setMetaConnectedName] = useState('');
  const [metaAdAccountId,   setMetaAdAccountId]   = useState('');
  const [adAccounts,        setAdAccounts]        = useState([]);
  const [selectedAccount,   setSelectedAccount]   = useState('');
  const [connectingMeta,       setConnectingMeta]       = useState(false);
  const [savingAccount,        setSavingAccount]         = useState(false);
  const [disconnectingMeta,    setDisconnectingMeta]     = useState(false);
  const [metaMsg,              setMetaMsg]               = useState(null);
  const [fbReady,              setFbReady]               = useState(false);
  const [metaBalanceThreshold, setMetaBalanceThreshold]  = useState('5000');
  const [metaCarriedBalance,   setMetaCarriedBalance]    = useState('0');
  const [savingMetaThreshold,  setSavingMetaThreshold]   = useState(false);

  // SMS integration
  const [smsToken,       setSmsToken]       = useState('');
  const [smsIntakeUrl,   setSmsIntakeUrl]   = useState('');
  const [loadingSms,     setLoadingSms]     = useState(true);
  const [regenerating,   setRegenerating]   = useState(false);
  const [copied,         setCopied]         = useState(false);

  // Load FB JS SDK — set fbAsyncInit BEFORE injecting the script so it's
  // guaranteed to be called when the SDK finishes loading.
  useEffect(() => {
    const appId = import.meta.env.VITE_META_APP_ID;
    if (!appId) return;

    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' });
      setFbReady(true);
    };

    if (document.getElementById('fb-sdk')) {
      // Script already in DOM (e.g. hot-reload) — re-init if FB object exists
      if (window.FB) { window.FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' }); setFbReady(true); }
      return;
    }

    const s = document.createElement('script');
    s.id    = 'fb-sdk';
    s.src   = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  // Populate meta status from /settings load (runs after the Bosta settings useEffect)
  useEffect(() => {
    authFetch('/settings')
      .then(r => r.json())
      .then(d => {
        setMetaConnected(!!d.meta_connected);
        setMetaConnectedName(d.meta_connected_name || '');
        setMetaAdAccountId(d.meta_ad_account_id || '');
        setSelectedAccount(d.meta_ad_account_id || '');
        setMetaBalanceThreshold(d.meta_balance_threshold || '5000');
        setMetaCarriedBalance(d.meta_carried_balance || '0');
      })
      .catch(() => {});
  }, []);

  async function connectFacebook() {
    if (!window.FB) { setMetaMsg({ type: 'error', text: 'Facebook SDK not loaded yet. Try again in a moment.' }); return; }
    setConnectingMeta(true);
    setMetaMsg(null);
    window.FB.login((response) => {
      if (response.status !== 'connected') {
        setConnectingMeta(false);
        return;
      }
      authFetch('/meta/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: response.authResponse.accessToken }),
      })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) { setMetaMsg({ type: 'error', text: data.detail || 'Connection failed.' }); return; }
          setMetaConnected(true);
          setMetaConnectedName(data.connected_name || '');
          setAdAccounts(data.ad_accounts || []);
          if (data.ad_accounts?.length === 1) setSelectedAccount(data.ad_accounts[0].id);
        })
        .catch(e => setMetaMsg({ type: 'error', text: `Error: ${e.message}` }))
        .finally(() => setConnectingMeta(false));
    }, { scope: 'ads_read,ads_management' });
  }

  async function saveAdAccount() {
    if (!selectedAccount) return;
    setSavingAccount(true);
    setMetaMsg(null);
    const res = await authFetch('/meta/select-account', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ad_account_id: selectedAccount }),
    });
    setSavingAccount(false);
    if (res.ok) {
      setMetaAdAccountId(selectedAccount);
      setMetaMsg({ type: 'success', text: 'Ad account saved.' });
    } else {
      setMetaMsg({ type: 'error', text: 'Failed to save ad account.' });
    }
  }

  async function disconnectMeta() {
    if (!await confirm('Disconnect Meta Ads', 'Spend data will no longer appear on the dashboard.')) return;
    setDisconnectingMeta(true);
    setMetaMsg(null);
    const res = await authFetch('/meta/disconnect', { method: 'DELETE' });
    setDisconnectingMeta(false);
    if (res.ok) {
      setMetaConnected(false);
      setMetaConnectedName('');
      setMetaAdAccountId('');
      setSelectedAccount('');
      setAdAccounts([]);
      setMetaMsg({ type: 'success', text: 'Disconnected.' });
    }
  }

  async function saveMetaThreshold() {
    setSavingMetaThreshold(true);
    setMetaMsg(null);
    const res = await authFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta_balance_threshold: metaBalanceThreshold, meta_carried_balance: metaCarriedBalance }),
    });
    setSavingMetaThreshold(false);
    setMetaMsg(res.ok
      ? { type: 'success', text: 'Balance alert threshold saved.' }
      : { type: 'error',   text: 'Failed to save threshold.' });
  }

  useEffect(() => {
    authFetch('/sms/token')
      .then(r => r.json())
      .then(d => { setSmsToken(d.token || ''); setSmsIntakeUrl(d.intake_url || ''); })
      .catch(() => {})
      .finally(() => setLoadingSms(false));
  }, []);

  async function regenerateToken() {
    setRegenerating(true);
    const res = await authFetch('/sms/token/regenerate', { method: 'POST' });
    const d   = await res.json();
    setSmsToken(d.token || '');
    setSmsIntakeUrl(d.intake_url || '');
    setRegenerating(false);
  }

  function copyUrl() {
    navigator.clipboard.writeText(smsIntakeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    authFetch('/settings')
      .then(r => r.json())
      .then(d => {
        setApiKey(d.bosta_api_key || '');
        setBostaEmail(d.bosta_email || '');
        setBostaPassword(d.bosta_password || '');
        setBostaEmailPassword(d.bosta_email_password || '');
        setPayoutDays(d.bosta_payout_days || '2');
        setAlertEnabled(d.alert_enabled !== 'false');
        setAlertTime1(d.alert_time_1 || '09:00');
        const t2 = d.alert_time_2 || '';
        setAlertTime2On(!!t2);
        setAlertTime2(t2 || '18:00');
        setAlertDays(d.alert_low_stock_days || '30');
      })
      .catch(() => setMsg({ type: 'error', text: 'Failed to load settings.' }))
      .finally(() => setLoading(false));
  }, []);

  const _alertPayload = () => ({
    alert_enabled:        alertEnabled ? 'true' : 'false',
    alert_time_1:         alertTime1,
    alert_time_2:         alertTime2On ? alertTime2 : '',
    alert_low_stock_days: alertDays,
  });

  // Only include credential fields if non-empty — prevents wiping saved values when state isn't loaded
  function _credPayload() {
    const p = {};
    if (apiKey.trim())           p.bosta_api_key        = apiKey.trim();
    if (bostaEmail.trim())       p.bosta_email          = bostaEmail.trim();
    if (bostaPassword)           p.bosta_password       = bostaPassword;
    if (bostaEmailPassword)      p.bosta_email_password = bostaEmailPassword;
    return p;
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    const res = await authFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ..._credPayload(), ..._alertPayload(), bosta_payout_days: payoutDays }),
    });
    setSaving(false);
    setMsg(res.ok
      ? { type: 'success', text: 'Settings saved.' }
      : { type: 'error',   text: 'Failed to save settings.' });
  }

  async function testStockAlert() {
    setTestingStock(true);
    setMsg(null);
    try {
      const res  = await authFetch('/settings/trigger-stock-alert', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { setMsg({ type: 'error', text: data.detail || 'Failed to trigger test alert.' }); return; }
      const sent    = data.results?.filter(r => r.status === 'sent')    || [];
      const errors  = data.results?.filter(r => r.status === 'error')   || [];
      const skipped = data.results?.filter(r => r.status === 'skipped') || [];
      if (errors.length)  setMsg({ type: 'error',   text: `Error: ${errors.map(r => `${r.brand}: ${r.reason}`).join('; ')}` });
      else if (sent.length) setMsg({ type: 'success', text: `Email sent to ${sent.map(r => r.brand).join(', ')} — check your inbox.` });
      else setMsg({ type: 'error', text: `Skipped: ${skipped.map(r => `${r.brand} — ${r.reason}`).join('; ')}` });
    } finally { setTestingStock(false); }
  }

  async function testMetaAlert() {
    setTestingMeta(true);
    setMetaMsg(null);
    const res = await authFetch('/settings/trigger-meta-balance-alert', { method: 'POST' });
    setTestingMeta(false);
    setMetaMsg(res.ok
      ? { type: 'success', text: 'Test alert sent — check your email.' }
      : { type: 'error',   text: 'Failed to trigger test alert.' });
  }

  async function saveAlert() {
    setSavingAlert(true);
    setMsg(null);
    const res = await authFetch('/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ..._credPayload(), ..._alertPayload() }),
    });
    setSavingAlert(false);
    setMsg(res.ok
      ? { type: 'success', text: 'Alert settings saved.' }
      : { type: 'error',   text: 'Failed to save alert settings.' });
  }

  const toggleBtn = (show, setShow) => (
    <button
      onClick={() => setShow(s => !s)}
      style={{
        background: 'transparent', border: '1px solid var(--border)',
        color: 'var(--muted)', borderRadius: 'var(--radius-sm)',
        padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem',
        whiteSpace: 'nowrap',
      }}
    >
      {show ? 'Hide' : 'Show'}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {msg && <Alert type={msg.type} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {/* ── Bosta Integration ── */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0' }}>
          <CardTitle>Bosta Integration</CardTitle>
          {brandName && (
            <span style={{
              fontSize: '.78rem', fontWeight: 600, color: 'var(--accent)',
              background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.25)',
              borderRadius: '20px', padding: '.2rem .65rem',
            }}>
              {brandName}
            </span>
          )}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: '.5rem' }}>
          Configure your Bosta credentials to enable live stock value fetching and daily automation.
        </p>

        {/* API Key */}
        <label style={labelStyle}>Bosta API Key</label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={loading ? '••••••••' : apiKey}
            onChange={e => setApiKey(e.target.value)}
            disabled={loading}
            placeholder="Enter your Bosta API key…"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          {toggleBtn(showKey, setShowKey)}
        </div>

        {/* Bosta Email */}
        <label style={labelStyle}>Bosta Login Email</label>
        <div style={{ marginBottom: '1.25rem' }}>
          <input
            type="email"
            value={loading ? '' : bostaEmail}
            onChange={e => setBostaEmail(e.target.value)}
            disabled={loading}
            placeholder="email@example.com"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
        </div>

        {/* Bosta Password */}
        <label style={labelStyle}>Bosta Login Password</label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
          <input
            type={showPass ? 'text' : 'password'}
            value={loading ? '' : bostaPassword}
            onChange={e => setBostaPassword(e.target.value)}
            disabled={loading}
            placeholder="Your Bosta account password…"
            style={inputStyle}
          />
          {toggleBtn(showPass, setShowPass)}
        </div>

        {/* Gmail App Password */}
        <label style={labelStyle}>Gmail App Password <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(for report email download)</span></label>
        <p style={{ fontSize: '.8rem', color: 'var(--muted)', marginBottom: '.5rem', marginTop: '-.25rem' }}>
          Generate at Gmail → Settings → Security → 2-Step Verification → App Passwords. Not your Gmail login password.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.5rem' }}>
          <input
            type={showEmailPass ? 'text' : 'password'}
            value={loading ? '' : bostaEmailPassword}
            onChange={e => setBostaEmailPassword(e.target.value)}
            disabled={loading}
            placeholder="xxxx xxxx xxxx xxxx"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          {toggleBtn(showEmailPass, setShowEmailPass)}
        </div>

        <label style={labelStyle}>Payout email lookback</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '1.5rem' }}>
          <input
            type="number"
            min="1"
            max="365"
            value={loading ? '' : payoutDays}
            onChange={e => setPayoutDays(e.target.value)}
            disabled={loading}
            style={{ ...inputStyle, flex: 'none', width: 80, textAlign: 'center' }}
          />
          <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>days</span>
        </div>

        <Btn onClick={save} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save Settings'}
        </Btn>
      </Card>

      {/* ── Stock Alert Settings ── */}
      <Card>
        <CardTitle>Stock Alert Settings</CardTitle>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: '.5rem' }}>
          Receive email alerts when items are out of stock or running low. Emails are sent to your Bosta login email above.
        </p>

        {/* Enable toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '1.5rem' }}>
          <input
            id="alert-enabled"
            type="checkbox"
            checked={alertEnabled}
            onChange={e => setAlertEnabled(e.target.checked)}
            disabled={loading}
            style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <label htmlFor="alert-enabled" style={{ fontSize: '.9rem', color: 'var(--text)', cursor: 'pointer' }}>
            Enable stock alert emails
          </label>
        </div>

        {/* Alert Times */}
        <label style={labelStyle}>Alert Times (UTC)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '.85rem', color: 'var(--muted)', minWidth: 48 }}>Time 1</span>
            <TimePicker value={alertTime1} onChange={setAlertTime1} disabled={loading || !alertEnabled} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '.85rem', color: 'var(--muted)', minWidth: 48 }}>Time 2</span>
            <TimePicker value={alertTime2} onChange={setAlertTime2} disabled={loading || !alertEnabled || !alertTime2On} />
            <label style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.85rem', color: 'var(--muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!alertTime2On}
                onChange={e => setAlertTime2On(!e.target.checked)}
                disabled={loading || !alertEnabled}
                style={{ accentColor: 'var(--accent)' }}
              />
              Disable
            </label>
          </div>
        </div>

        {/* Threshold */}
        <label style={labelStyle}>Low stock threshold</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '1.5rem' }}>
          <input
            type="number"
            min="1"
            max="365"
            value={alertDays}
            onChange={e => setAlertDays(e.target.value)}
            disabled={loading || !alertEnabled}
            style={{ ...inputStyle, flex: 'none', width: 80, textAlign: 'center' }}
          />
          <span style={{ fontSize: '.9rem', color: 'var(--muted)' }}>days remaining</span>
        </div>

        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
          <Btn onClick={saveAlert} disabled={savingAlert || loading}>
            {savingAlert ? 'Saving…' : 'Save Alert Settings'}
          </Btn>
          <Btn variant="outline" onClick={testStockAlert} disabled={testingStock || loading}>
            {testingStock ? 'Sending…' : 'Send Test Alert'}
          </Btn>
        </div>
      </Card>

      {/* ── Meta Ads Integration ── */}
      <Card>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg,#1877f2,#0a5dc2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
          </div>
          <div>
            <CardTitle style={{ marginBottom: 0 }}>Meta Ads</CardTitle>
            <p style={{ color: 'var(--muted)', fontSize: '.8rem', margin: 0 }}>
              Facebook Ads spend &amp; campaign data
            </p>
          </div>
        </div>

        {metaMsg && <Alert type={metaMsg.type} onClose={() => setMetaMsg(null)} style={{ marginBottom: '1rem' }}>{metaMsg.text}</Alert>}

        {!metaConnected ? (
          <div style={{
            border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
            padding: '1.5rem', textAlign: 'center',
          }}>
            <p style={{ color: 'var(--muted)', fontSize: '.875rem', marginBottom: '1.25rem', marginTop: 0 }}>
              Connect your Facebook account to pull ad spend into the dashboard,<br/>Bosta reports, and BI assistant.
            </p>
            <button
              onClick={connectFacebook}
              disabled={connectingMeta || !fbReady}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '.5rem',
                background: connectingMeta || !fbReady ? 'var(--surface)' : '#1877f2',
                color: connectingMeta || !fbReady ? 'var(--muted)' : '#fff',
                border: connectingMeta || !fbReady ? '1px solid var(--border)' : 'none',
                borderRadius: 'var(--radius-sm)', padding: '.6rem 1.25rem',
                fontSize: '.9rem', fontWeight: 600, cursor: connectingMeta || !fbReady ? 'not-allowed' : 'pointer',
                transition: 'opacity .15s',
              }}
            >
              {connectingMeta ? (
                <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />Connecting…</>
              ) : !fbReady ? 'Loading SDK…' : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>Continue with Facebook</>
              )}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Connected badge row */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '.75rem', flexWrap: 'wrap',
              background: 'rgba(24,119,242,.08)', border: '1px solid rgba(24,119,242,.2)',
              borderRadius: 'var(--radius)', padding: '.75rem 1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
                  boxShadow: '0 0 0 3px rgba(34,197,94,.2)',
                }} />
                <span style={{ fontSize: '.875rem', fontWeight: 600, color: 'var(--text)' }}>
                  {metaConnectedName}
                </span>
                <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>connected</span>
              </div>
              <button
                onClick={disconnectMeta}
                disabled={disconnectingMeta}
                style={{
                  background: 'transparent', border: '1px solid var(--danger)',
                  color: 'var(--danger)', borderRadius: 'var(--radius-sm)',
                  padding: '.25rem .65rem', cursor: 'pointer', fontSize: '.8rem', fontWeight: 500,
                }}
              >
                {disconnectingMeta ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </div>

            {/* Ad account picker */}
            <div>
              <label style={labelStyle}>Ad Account</label>
              {adAccounts.length > 0 ? (
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <select
                    value={selectedAccount}
                    onChange={e => setSelectedAccount(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    <option value="">— Select an ad account —</option>
                    {adAccounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                    ))}
                  </select>
                  <Btn onClick={saveAdAccount} disabled={savingAccount || !selectedAccount}>
                    {savingAccount ? 'Saving…' : 'Save'}
                  </Btn>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
                  <input
                    readOnly
                    value={metaAdAccountId || 'No ad account selected'}
                    style={{ ...inputStyle, color: 'var(--muted)', fontFamily: 'monospace', flex: 1 }}
                  />
                  <Btn variant="outline" onClick={connectFacebook} disabled={connectingMeta}>
                    {connectingMeta ? 'Loading…' : 'Re-fetch accounts'}
                  </Btn>
                </div>
              )}
            </div>

            {/* Balance alert threshold */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
              <label style={labelStyle}>Balance Alert Threshold</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '.8rem', color: 'var(--muted)', pointerEvents: 'none',
                }}>EGP</span>
                <input
                  type="number"
                  min="0"
                  value={metaBalanceThreshold}
                  onChange={e => setMetaBalanceThreshold(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '2.75rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.4rem' }}>
                An email alert is sent every 10 minutes when your Meta Ads balance drops below this amount.
              </p>

              <label style={{ ...labelStyle, marginTop: '1rem' }}>Meta Opening Balance</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: '.75rem', top: '50%', transform: 'translateY(-50%)',
                  fontSize: '.8rem', color: 'var(--muted)', pointerEvents: 'none',
                }}>EGP</span>
                <input
                  type="number"
                  min="0"
                  value={metaCarriedBalance}
                  onChange={e => setMetaCarriedBalance(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: '2.75rem', width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <p style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: '.4rem' }}>
                The balance already in your Meta wallet before you started tracking deposits here.
              </p>

              <div style={{ display: 'flex', gap: '.75rem', marginTop: '1.25rem' }}>
                <Btn onClick={saveMetaThreshold} disabled={savingMetaThreshold}>
                  {savingMetaThreshold ? 'Saving…' : 'Save Meta Settings'}
                </Btn>
                <Btn variant="outline" onClick={testMetaAlert} disabled={testingMeta}>
                  {testingMeta ? 'Sending…' : 'Test Alert'}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Bank SMS Integration ── */}
      <Card>
        <CardTitle>Bank SMS Integration</CardTitle>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginBottom: '1.5rem', marginTop: '.5rem' }}>
          Automatically capture CIB deduction messages as cashflow suggestions. Set up an iOS Shortcut that posts each bank SMS to this webhook.
        </p>

        <label style={labelStyle}>Webhook URL (paste into iOS Shortcut)</label>
        <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
          <input
            readOnly
            value={loadingSms ? 'Loading…' : smsIntakeUrl}
            style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '.78rem', color: 'var(--muted)' }}
            onFocus={e => e.target.select()}
          />
          <button
            onClick={copyUrl}
            disabled={loadingSms || !smsIntakeUrl}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              color: copied ? 'var(--success)' : 'var(--muted)', borderRadius: 'var(--radius-sm)',
              padding: '.5rem .75rem', cursor: 'pointer', fontSize: '.85rem', whiteSpace: 'nowrap',
            }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <Btn variant="outline" onClick={regenerateToken} disabled={regenerating || loadingSms} style={{ marginBottom: '1.5rem' }}>
          {regenerating ? 'Regenerating…' : 'Regenerate Token'}
        </Btn>

        <details style={{ marginTop: '.25rem' }}>
          <summary style={{ fontSize: '.85rem', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600, marginBottom: '.75rem' }}>
            iOS Shortcut setup instructions
          </summary>
          <ol style={{ fontSize: '.85rem', color: 'var(--muted)', lineHeight: 1.8, paddingLeft: '1.2rem', marginTop: '.5rem' }}>
            <li>Open the <strong>Shortcuts</strong> app → <strong>Automation</strong> tab → <strong>New Automation</strong></li>
            <li>Trigger: <strong>Message</strong> → filter <em>Message Contains</em> → type <code>19666</code></li>
            <li>Add action: <strong>Get Contents of URL</strong>
              <ul style={{ marginTop: '.25rem', listStyle: 'disc', paddingLeft: '1rem' }}>
                <li>URL: paste the webhook URL above</li>
                <li>Method: <strong>POST</strong></li>
                <li>Request Body: <strong>JSON</strong></li>
                <li>Add field <code>body</code> → value: tap <em>Shortcut Input</em></li>
              </ul>
            </li>
            <li>Turn off <strong>"Ask Before Running"</strong> so it fires silently</li>
          </ol>
        </details>
      </Card>
      <Dialog {...dialogProps} />
    </div>
  );
}
