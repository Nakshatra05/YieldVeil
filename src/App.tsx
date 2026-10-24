import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ArrowRight, ChevronDown, Copy, Download, ExternalLink, EyeOff, FileKey2, Fingerprint, Info, Layers3, Leaf, LockKeyhole, Menu, Plus, Settings2, Shield, Sparkles, Sprout, UnlockKeyhole, Wallet, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { DEMO_FEE, DEMO_RATE, UNIT, deposit, emptyVault, exactAmount, formatAmount, parseAmount, projection, withdraw, type Vault as VaultData, type Note } from './lib/protocol';
import { decryptVault, downloadBackup, encryptVault, STORAGE_KEY } from './lib/vault';
import { getAquaRoute, type ExitChain } from './lib/aqua';

type Page = 'vault' | 'activity' | 'how' | 'settings';
type AuthMode = 'create' | 'unlock' | 'import';
type WalletProvider = { request: (args: { method: string }) => Promise<unknown>; on?: (event: string, callback: (...args: unknown[]) => void) => void; removeListener?: (event: string, callback: (...args: unknown[]) => void) => void };
const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
function storedVault(): string | null { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

function Brand({ small = false }: { small?: boolean }) {
  return <div className={`brand ${small ? 'small' : ''}`}><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m5 5 11 23L27 5M12 5l4 9 4-9" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /></svg></span><span>yieldveil<span className="brand-dot">.</span></span></div>;
}
function EthIcon() { return <svg viewBox="0 0 24 36" width="20" height="30" aria-hidden="true"><path d="M12 1 1 19l11 6 11-6Z" fill="#7865bb" stroke="#25212b" strokeWidth="1.2"/><path d="m1 22 11 13 11-13-11 6Z" fill="#a18ce3" stroke="#25212b" strokeWidth="1.2"/><path d="M12 1v24M1 19l11-5 11 5" fill="none" stroke="#25212b" strokeWidth="1.2"/></svg>; }
function VaultArt() {
  return <div className="vault-art" aria-hidden="true"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span><div className="floating-tag"><Leaf size={15}/> earning, quietly.</div><svg viewBox="0 0 270 240" className="safe-art"><path d="m58 58 115-25 60 39-114 27Z" fill="#f4eaff" stroke="#1c1c20" strokeWidth="3"/><path d="m58 58 61 41v133l-61-42Z" fill="#a28bd5" stroke="#1c1c20" strokeWidth="3"/><path d="m119 99 114-27v131l-114 29Z" fill="#c6b2ed" stroke="#1c1c20" strokeWidth="3"/><path d="m135 111 81-19v94l-81 21Z" fill="#e7dcfa" stroke="#1c1c20" strokeWidth="3"/><path d="m143 118 65-16v76l-65 17Z" fill="#bfa9e8" stroke="#1c1c20" strokeWidth="2"/><ellipse cx="175" cy="148" rx="23" ry="26" transform="rotate(16 175 148)" fill="#d7fa75" stroke="#1c1c20" strokeWidth="3"/><path d="m175 126 1 44m-20-18 39-9m-34-11 29 28" stroke="#1c1c20" strokeWidth="3"/><ellipse cx="175" cy="148" rx="8" ry="9" fill="#f5ffc7" stroke="#1c1c20" strokeWidth="3"/><path d="m127 126 9-2v14l-9 2Zm0 48 9-2v14l-9 2Z" fill="#1c1c20"/><path d="m75 201 8 6v10l-8-5Zm126 10 9-2v10l-9 2Z" fill="#1c1c20"/><path d="m120 82 0-26" stroke="#1c1c20" strokeWidth="3"/><ellipse cx="120" cy="47" rx="27" ry="12" transform="rotate(-13 120 47)" fill="#d7fa75" stroke="#1c1c20" strokeWidth="3"/><path d="m94 47 3 12c2 7 54-3 51-14l-2-7" fill="#b3d657" stroke="#1c1c20" strokeWidth="3"/><ellipse cx="120" cy="42" rx="27" ry="12" transform="rotate(-13 120 42)" fill="#e4ff9c" stroke="#1c1c20" strokeWidth="3"/><path d="m117 34 8 8-6 6-7-7Z" fill="#1c1c20"/></svg><span className="art-badge"><EyeOff size={19}/></span></div>;
}
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; d?.showModal(); return () => d?.close(); }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="dialog-head"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={21}/></button></div>{children}</dialog>;
}

export default function App() {
  const [page, setPage] = useState<Page>('vault');
  const [vault, setVault] = useState<VaultData | null>(null);
  const [hasStored, setHasStored] = useState(() => !!storedVault());
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [importText, setImportText] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [account, setAccount] = useState('');
  const [walletBusy, setWalletBusy] = useState(false);
  const passRef = useRef('');
  const snapshot = useRef<string | null>(storedVault());
  const mutex = useRef(false);
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [asset, setAsset] = useState<'ETH' | 'wstETH'>('ETH');
  const [amount, setAmount] = useState('1');
  const [recipient, setRecipient] = useState('');
  const [selectedNote, setSelectedNote] = useState('');
  const [chain, setChain] = useState<ExitChain>('ethereum');
  const [formError, setFormError] = useState('');
  const [progress, setProgress] = useState('');
  const [days, setDays] = useState(365);
  const [apr, setApr] = useState(3);
  const [ragequitNote, setRagequitNote] = useState<Note | null>(null);
  const activeNotes = vault?.notes.filter(n => n.status !== 'spent') ?? [];
  const shares = activeNotes.reduce((sum, n) => sum + BigInt(n.value), 0n);
  const ethValue = shares * DEMO_RATE / UNIT;
  const chartPrincipal = Number(ethValue) / 1e18 || 1;
  const projectedYield = projection(chartPrincipal, apr, days) - chartPrincipal;
  const currentNote = activeNotes.find(n => n.id === selectedNote) ?? activeNotes[0];
  let amountValue = 0n;
  try { amountValue = parseAmount(amount); } catch { /* Validation is shown on submit. */ }
  const receive = tab === 'deposit' ? (asset === 'ETH' ? amountValue * UNIT / DEMO_RATE : amountValue) : amountValue > DEMO_FEE ? amountValue - DEMO_FEE : 0n;

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 6500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
    if (!provider?.on) return;
    const changed = (...args: unknown[]) => { const accounts = args[0]; setAccount(Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0] : ''); };
    const disconnected = () => setAccount('');
    provider.on('accountsChanged', changed); provider.on('disconnect', disconnected);
    return () => { provider.removeListener?.('accountsChanged', changed); provider.removeListener?.('disconnect', disconnected); };
  }, []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) { passRef.current = ''; setVault(null); setHasStored(!!e.newValue); snapshot.current = e.newValue; setToast('Vault changed in another tab. Unlock again to use the latest state.'); }
    };
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    if (!vault) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => { clearTimeout(timer); timer = setTimeout(() => { if (!mutex.current) { passRef.current = ''; setVault(null); setToast('Vault locked after 10 minutes of inactivity.'); } else reset(); }, 600000); };
    reset(); window.addEventListener('pointerdown', reset); window.addEventListener('keydown', reset);
    return () => { clearTimeout(timer); window.removeEventListener('pointerdown', reset); window.removeEventListener('keydown', reset); };
  }, [!!vault]);

  function openAuth(mode?: AuthMode) { setPassword(''); setConfirmPassword(''); setImportText(''); setAuthError(''); setAuth(mode ?? (hasStored ? 'unlock' : 'create')); }
  async function save(next: VaultData, key = passRef.current) {
    const expected = snapshot.current;
    const encrypted = await encryptVault(next, key);
    const write = () => {
      if (localStorage.getItem(STORAGE_KEY) !== expected) throw new Error('Vault changed in another tab. Reload and unlock before continuing.');
      localStorage.setItem(STORAGE_KEY, encrypted); snapshot.current = encrypted;
    };
    if (navigator.locks) await navigator.locks.request('yieldveil-vault', write); else write();
    setVault(next); setHasStored(true);
  }
  async function authenticate(e: React.FormEvent) {
    e.preventDefault(); if (mutex.current) return;
    mutex.current = true; setBusy(true); setAuthError('');
    try {
      if (auth === 'create') {
        if (password !== confirmPassword) throw new Error('Passphrases do not match.');
        if (storedVault()) throw new Error('An encrypted vault already exists. Unlock or restore it in Settings.');
        snapshot.current = null; await save(emptyVault(), password);
      } else {
        const baseline = storedVault();
        const text = auth === 'import' ? importText : baseline;
        if (!text) throw new Error('Choose an encrypted backup file first.');
        const decoded = await decryptVault(text, password);
        if (storedVault() !== baseline) throw new Error('Vault changed in another tab. Unlock the latest copy again.');
        snapshot.current = baseline;
        if (auth === 'import') await save(decoded, password); else setVault(decoded);
      }
      passRef.current = password; setPassword(''); setConfirmPassword(''); setAuth(null); setToast(auth === 'create' ? 'Demo vault created. You can now simulate your first deposit.' : 'Your demo vault is unlocked.');
    } catch (e) { setAuthError(errorMessage(e)); }
    finally { mutex.current = false; setBusy(false); }
  }
  async function checkWitness(note: Note) {
    return new Promise<void>((resolve, reject) => {
      const worker = new Worker(new URL('./workers/witness.worker.ts', import.meta.url), { type: 'module' });
      const timer = setTimeout(() => { worker.terminate(); reject(new Error('Local note check timed out.')); }, 15000);
      const cleanup = () => { clearTimeout(timer); worker.terminate(); };
      worker.onmessage = (e: MessageEvent<{ ok: boolean; error?: string }>) => { cleanup(); e.data.ok ? resolve() : reject(new Error(e.data.error)); };
      worker.onerror = () => { cleanup(); reject(new Error('Unable to start local note check.')); };
      worker.postMessage(note);
    });
  }
  async function transact(e: React.FormEvent) {
    e.preventDefault(); setFormError('');
    if (!vault) { openAuth(); return; }
    if (mutex.current) return;
    mutex.current = true; setBusy(true);
    try {
      const value = parseAmount(amount);
      let next: VaultData;
      if (tab === 'deposit') { setProgress('Creating a local commitment…'); next = deposit(vault, value, asset); }
      else {
        if (chain !== 'ethereum') throw new Error(getAquaRoute(chain).reason);
        if (!currentNote) throw new Error('Deposit first to create a demo note.');
        setProgress('Checking your note locally…'); await checkWitness(currentNote);
        next = withdraw(vault, currentNote.id, value, recipient);
      }
      setProgress('Encrypting your vault…'); await save(next);
      setToast(tab === 'deposit' ? 'Demo deposit complete. Your note is encrypted on this device.' : 'Demo withdrawal complete. No funds were sent; any change is saved as a fresh note.');
      if (tab === 'withdraw') { setRecipient(''); setAmount('0.1'); }
    } catch (e) { setFormError(errorMessage(e)); }
    finally { mutex.current = false; setBusy(false); setProgress(''); }
  }
  async function publicExit() {
    if (!vault || !ragequitNote || mutex.current) return;
    mutex.current = true; setBusy(true);
    try { await save(withdraw(vault, ragequitNote.id, BigInt(ragequitNote.value), ragequitNote.depositor, true)); setRagequitNote(null); setToast('Public exit simulated. No funds were sent.'); }
    catch(e) { setToast(errorMessage(e)); }
    finally { mutex.current = false; setBusy(false); }
  }
  async function connectWallet() {
    if (account) { setAccount(''); return; }
    const provider = (window as Window & { ethereum?: WalletProvider }).ethereum;
    if (!provider) { setToast('No browser wallet found. The demo works without one — use Create demo vault.'); return; }
    setWalletBusy(true);
    try { const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[]; setAccount(accounts[0] ?? ''); setToast('Wallet connected for display only. This prototype never requests signatures or transactions.'); }
    catch { setToast('Wallet connection was declined or unavailable. You can still use the demo.'); }
    finally { setWalletBusy(false); }
  }
  function navigate(p: Page) { setPage(p); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'instant' }); }
  function lock() { passRef.current = ''; setVault(null); setToast('Vault locked. Your encrypted notes stay on this device.'); }
  function exportBackup() { const data = storedVault(); if (data) { downloadBackup(data); setToast('Encrypted backup downloaded. Keep your passphrase separately.'); } }

  return <>
    <div className="announcement"><span className="announcement-dot"/> PRIVACY THAT PAYS. <span className="announcement-divider">/</span><span> A new home for your ETH.</span><a href="#how" onClick={e => { e.preventDefault(); navigate('how'); }}>Meet Yieldveil <ArrowUpRight size={14}/></a></div>
    <header className="site-header"><a href="#vault" className="brand-link" aria-label="Yieldveil home" onClick={e => { e.preventDefault(); navigate('vault'); }}><Brand/></a><nav aria-label="Main navigation" className={mobileMenu ? 'open' : ''}>{([['vault', 'The vault'], ['activity', 'Activity'], ['how', 'How it works']] as const).map(([id, label]) => <button key={id} onClick={() => navigate(id)} className={page === id ? 'nav-link active' : 'nav-link'} aria-current={page === id ? 'page' : undefined}>{label}</button>)}<a className="nav-link external" href="https://github.com/Nakshatra05/YieldVeil" target="_blank" rel="noreferrer">Docs <ArrowUpRight size={14}/></a></nav><div className="header-actions"><span className="network"><span/> Ethereum <ChevronDown size={13}/></span><button className="button wallet-button" onClick={connectWallet} disabled={walletBusy}><Wallet size={17}/><span>{walletBusy ? 'Connecting…' : account ? short(account) : 'Connect wallet'}</span></button><button className="icon-button mobile-toggle" aria-label="Toggle navigation" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu/></button></div></header>
    <main>
      <div className="page-top"><span className="eyebrow"><span className="live-dot"/> THE PRIVATE SIDE OF DEFI</span><button className="demo-label" onClick={() => navigate('how')}><span/> RESIDENCY PROTOTYPE <Info size={13}/></button></div>
      {page === 'vault' && <>
        <section className="hero"><div className="hero-copy"><h1>Your ETH. <span>Undercover.</span><br/>Your yield. <span className="highlight">On the clock.<svg viewBox="0 0 320 12" preserveAspectRatio="none" aria-hidden="true"><path d="M3 7Q130 0 317 5M35 11Q160 6 289 10" fill="none" stroke="currentColor" strokeWidth="3"/></svg></span></h1><p>Stake it. Shield it. Let it grow.<br/>A private home for your ETH that never stops working.</p></div><VaultArt/></section>
        <div className="workspace-grid"><div className="overview-column">
          <section className="balance-card panel"><div className="card-top"><span className="eyebrow"><Shield size={15}/> YOUR SHIELDED VAULT</span><span className="badge"><span className="live-dot"/> {vault ? 'DEMO ACTIVE' : 'DEMO MODE'}</span></div><div className="balance-number">{formatAmount(shares)} <span>wstETH</span><EyeOff size={23}/></div><div className="balance-sub">≈ {formatAmount(ethValue)} ETH <span>at the illustrative exchange rate</span></div><div className="balance-bottom"><div><span className="field-label">PROJECTED ANNUAL YIELD</span><strong><Sprout size={17}/> +{formatAmount(ethValue * BigInt(Math.round(apr * 100)) / 10000n)} ETH</strong></div><div><span className="field-label">YOUR LOCAL NOTES</span><strong><FileKey2 size={17}/>{activeNotes.length} {activeNotes.length === 1 ? 'note' : 'notes'} <span className="small-light">/ encrypted</span></strong></div><button className="small-button" onClick={() => vault ? lock() : openAuth()} disabled={busy}>{vault ? <LockKeyhole size={14}/> : <Plus size={14}/>} {vault ? 'Lock vault' : hasStored ? 'Unlock vault' : 'Create vault'}</button></div></section>
          <div className="metrics"><div className="metric panel"><span className="metric-icon green"><Leaf size={20}/></span><span className="field-label">ILLUSTRATIVE STAKING APR</span><strong>{apr.toFixed(1)}<span>%</span></strong><span className="metric-foot">Variable, never guaranteed <ArrowUpRight size={14}/></span></div><div className="metric panel"><span className="metric-icon lavender"><Fingerprint size={20}/></span><span className="field-label">PRIVACY BY DESIGN</span><strong>Your keys.</strong><span className="metric-foot">Notes stay on your device <LockKeyhole size={13}/></span></div></div>
          <section className="chart-card panel"><div className="card-top"><div><span className="eyebrow">PATIENCE LOOKS GOOD ON YOU</span><h2>Same ETH. More possibility.</h2></div><div className="segmented small" aria-label="Projection period">{[90,180,365].map(d => <button key={d} className={days === d ? 'selected' : ''} onClick={() => setDays(d)} aria-pressed={days === d}>{d === 90 ? '3M' : d === 180 ? '6M' : '1Y'}</button>)}</div></div><div className="chart-summary"><strong>+{projectedYield.toFixed(4)} <span>ETH</span></strong><span>projected on {chartPrincipal.toFixed(2)} ETH over {days} days</span></div><YieldChart principal={chartPrincipal} apr={apr} days={days}/><div className="chart-footer"><span><i className="legend-dot purple"/> With staking yield</span><span><i className="legend-dot gray"/> Idle ETH</span><span>Illustration · {apr.toFixed(1)}% APR</span></div></section>
        </div><div className="action-column">
          <section className="action-card panel"><div className="action-heading"><span>Make your move.</span><Sparkles size={20}/></div><div className="segmented action-tabs" aria-label="Vault action"><button className={tab === 'deposit' ? 'selected' : ''} aria-pressed={tab === 'deposit'} onClick={() => { setTab('deposit'); setAmount('1'); setFormError(''); }}><ArrowDownLeft size={17}/> Deposit</button><button className={tab === 'withdraw' ? 'selected' : ''} aria-pressed={tab === 'withdraw'} onClick={() => { setTab('withdraw'); setAmount('0.1'); setFormError(''); }}><ArrowUpRight size={17}/> Withdraw</button></div>
            <form onSubmit={transact}><div className="input-top"><label htmlFor="amount">{tab === 'deposit' ? 'You deposit' : 'Spend from note'}</label><span>Simulated funds</span></div><div className="amount-box"><input id="amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} aria-describedby="amount-hint"/><div className="asset-select"><EthIcon/>{tab === 'deposit' ? <select aria-label="Deposit asset" value={asset} onChange={e => setAsset(e.target.value as 'ETH' | 'wstETH')}><option>ETH</option><option>wstETH</option></select> : <span>wstETH</span>}</div></div><div className="presets">{['0.1','0.5','1','5'].map(v => <button type="button" key={v} onClick={() => setAmount(v)} className={amount === v ? 'chosen' : ''}>{v}</button>)}{tab === 'withdraw' && currentNote && <button type="button" onClick={() => setAmount(exactAmount(BigInt(currentNote.value)))}>MAX</button>}</div>
            {tab === 'deposit' ? <><div className="flow-arrow"><ArrowDownLeft size={16}/></div><div className="receive-box"><div><span className="field-label">YOUR NOTE WILL HOLD</span><strong>{formatAmount(receive, 6)} <span>wstETH</span></strong></div><span className="token-circle"><EthIcon/></span></div><div className="transaction-details"><div><span>Exchange rate <Info size={12}/></span><span>1 wstETH = 1.20 ETH</span></div><div><span>Staking APR</span><span className="positive">{apr.toFixed(1)}% illustrative</span></div><div><span>Network fee</span><span>None in demo</span></div></div></> : <div className="withdraw-fields"><label htmlFor="note">Spendable note</label><select id="note" value={currentNote?.id ?? ''} onChange={e => setSelectedNote(e.target.value)}>{activeNotes.length ? activeNotes.map(n => <option key={n.id} value={n.id}>{formatAmount(BigInt(n.value), 6)} wstETH · {n.status}</option>) : <option value="">No notes yet — deposit first</option>}</select><label htmlFor="recipient">Fresh recipient address</label><input id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false}/><label htmlFor="chain">Exit network</label><select id="chain" value={chain} onChange={e => setChain(e.target.value as ExitChain)}><option value="ethereum">Ethereum · simulated wstETH exit</option><option value="base">Base · AQUA0 not connected</option><option value="arbitrum">Arbitrum · AQUA0 not connected</option></select>{chain !== 'ethereum' && <p className="inline-warning">{getAquaRoute(chain).reason}</p>}<div className="transaction-details"><div><span>Illustrative relayer fee</span><span>{formatAmount(DEMO_FEE)} wstETH</span></div><div><span>Recipient receives</span><strong>{formatAmount(receive, 6)} wstETH</strong></div></div></div>}
            {formError && <div className="form-error" role="alert">{formError}</div>}<button type="submit" className="button primary full" disabled={busy || (tab === 'withdraw' && chain !== 'ethereum')}>{busy ? <><span className="spinner"/>{progress || 'Working…'}</> : !vault ? <><LockKeyhole size={18}/>{hasStored ? 'Unlock demo vault' : 'Create demo vault'}<ArrowRight size={18}/></> : <><Shield size={18}/>{tab === 'deposit' ? 'Simulate shielded deposit' : 'Simulate withdrawal'}<ArrowRight size={18}/></>}</button><p className="form-caption" id="amount-hint"><LockKeyhole size={12}/> Demo only. No real funds. No ZK proof or onchain privacy.</p></form>
          </section><div className="note-callout"><span className="callout-icon"><FileKey2 size={23}/></span><div><strong>Your note. Your control.</strong><p>Encrypted on this device. Back it up, keep your passphrase safe, and make yourself at home.</p><button className="text-link" onClick={() => navigate('settings')}>Manage your vault <ArrowUpRight size={14}/></button></div></div>
        </div></div>
        <section className="aqua-banner"><div className="aqua-symbol"><Layers3 size={34}/></div><div className="aqua-copy"><span className="eyebrow">BUILT FOR WHAT COMES NEXT</span><h2>Private capital. A more liquid future.</h2><p>Exploring programmable liquidity and cross-chain exits with AQUA0.</p></div><button className="button aqua-button" onClick={() => navigate('how')}>Explore the vision <ArrowUpRight size={17}/></button><span className="aqua-stamp">AQUA0<br/><small>ADAPTER RESEARCH</small></span></section>
        <section className="principles"><div><span>01</span><div><strong>Deposit once.</strong><p>ETH becomes a wstETH-denominated note.</p></div></div><div><span>02</span><div><strong>Let time do its thing.</strong><p>Staking rewards can grow the note’s ETH value.</p></div></div><div><span>03</span><div><strong>Leave on your terms.</strong><p>The goal: prove ownership, keep the link private.</p></div></div></section>
      </>}
      {page === 'activity' && <section className="inner-page"><div className="section-title"><span className="eyebrow">FOR YOUR EYES ONLY</span><h1>Your activity<span className="purple-text">.</span></h1><p>Local demo history. Encrypted with your notes. Never sent to a server.</p></div><div className="panel activity-panel"><div className="card-top"><h2>Vault activity</h2><span className="badge">SIMULATED</span></div>{vault?.activity.length ? vault.activity.map(a => <div className="activity-row" key={a.id}><span className={`activity-icon ${a.type === 'deposit' ? 'green' : 'lavender'}`}>{a.type === 'deposit' ? <ArrowDownLeft/> : <ArrowUpRight/>}</span><div><strong>{a.type === 'deposit' ? 'Shielded deposit' : a.type === 'withdraw' ? 'Private withdrawal simulation' : 'Public exit simulation'}</strong><span>{new Date(a.timestamp).toLocaleString()} {a.recipient ? `· to ${short(a.recipient)}` : ''}</span></div><div className="activity-value"><strong>{a.type === 'deposit' ? '+' : '−'}{formatAmount(BigInt(a.value), 6)} wstETH</strong><span>Local demo · no transaction</span></div></div>) : <EmptyState icon={<Layers3 size={30}/>} title={vault ? 'A fresh start.' : 'Your history is under lock.'} text={vault ? 'Your first simulated deposit will appear here.' : 'Unlock your demo vault to see your local activity.'} action={vault ? 'Make a deposit' : hasStored ? 'Unlock vault' : 'Create demo vault'} onClick={() => vault ? navigate('vault') : openAuth()}/>}</div></section>}
      {page === 'how' && <section className="inner-page"><div className="section-title"><span className="eyebrow">AQUA0 RESIDENCY / THE THESIS</span><h1>Privacy that <span className="highlight">pays.</span></h1><p>Idle capital is a missed opportunity. Yieldveil explores how staking yield can help make privacy self-sustaining.</p></div><div className="how-grid">{[{icon:<ArrowDownLeft/>,title:'Stake & shield',text:'The planned deposit adapter stakes ETH through Lido and measures the actual wstETH received. Notes hold fixed wstETH shares, not a rebasing balance.'},{icon:<Sprout/>,title:'Earn while you wait',text:'The wstETH balance stays constant. Its stETH redemption value can increase with staking rewards. Yield may help cover exit costs; it is not guaranteed.'},{icon:<Fingerprint/>,title:'Prove, then exit',text:'The planned withdrawal circuit proves note ownership and association-set membership, binds the recipient and fee, and spends a nullifier once.'}].map((item,i) => <div className="panel how-card" key={item.title}><div className="how-icon">{item.icon}<span>0{i+1}</span></div><h2>{item.title}</h2><p>{item.text}</p></div>)}</div><section className="panel roadmap"><div className="card-top"><div><span className="eyebrow">HONEST BY DEFAULT</span><h2>What works today. What comes next.</h2></div><Shield size={26}/></div><div className="roadmap-row"><span className="status-pill built">BUILT</span><div><strong>Interactive browser prototype</strong><p>Integer share accounting, Poseidon commitments, encrypted local notes and backups, partial withdrawal simulation, and a Web Worker note integrity check.</p></div></div><div className="roadmap-row"><span className="status-pill planned">NEXT</span><div><strong>Testnet protocol & real ZK proofs</strong><p>Deploy custody contracts, integrate reviewed circuits and proving artifacts, and build a reorg-aware indexer, ASP service, and relayer. No real ZK proofs or chain transactions run in this release.</p></div></div><div className="roadmap-row"><span className="status-pill research">RESEARCH</span><div><strong>AQUA0 liquidity / exit adapter</strong><p>Validate supported assets, chains, routing, settlement, and failure recovery with the AQUA0 team. Cross-chain execution remains disabled. AQUA0 is not assumed to provide privacy.</p></div></div><div className="roadmap-row"><span className="status-pill planned">BEFORE LIVE</span><div><strong>Independent security review</strong><p>Separate contract and circuit audits, trusted-setup review where applicable, a capped launch, and a tested public escape hatch. Timing, amounts, and network metadata can still weaken privacy.</p></div></div></section><div className="two-panels"><div className="panel explainer"><h2>Why wstETH?</h2><p>A note’s committed share amount cannot rebase. wstETH keeps the share count fixed while its stETH redemption value changes. ETH estimates also carry slashing, liquidity, and market-price risk.</p><a className="text-link" href="https://docs.lido.fi/contracts/wsteth/" target="_blank" rel="noreferrer">Read Lido’s documentation <ExternalLink size={14}/></a></div><div className="panel explainer"><h2>An exit, even when privacy can’t wait.</h2><p>The HLD includes ragequit: a public exit to the original depositor without ASP approval. You can explore this flow on your demo notes in Settings. It sacrifices unlinkability.</p><button className="text-link" onClick={() => navigate('settings')}>Explore public exit <ArrowUpRight size={14}/></button></div></div><div className="creator-strip"><Brand small/><span>Built by <a href="https://x.com/Naksh005" target="_blank" rel="noreferrer">Naksh ↗</a> · An independent AQUA0 residency project.</span></div></section>}
      {page === 'settings' && <section className="inner-page"><div className="section-title"><span className="eyebrow">YOUR DEVICE. YOUR CONTROL.</span><h1>Vault settings<span className="purple-text">.</span></h1><p>Keep a backup. Keep your passphrase. This prototype cannot recover either for you.</p></div><div className="two-panels"><section className="panel settings-panel"><span className="metric-icon lavender"><LockKeyhole/></span><h2>Encrypted note vault</h2><p>AES-256-GCM encryption with a passphrase-derived key. Only ciphertext is stored in your browser; unlocked notes exist in memory.</p><div className="settings-status"><span>Status</span><strong>{vault ? 'Unlocked' : hasStored ? 'Locked' : 'Not created'}</strong></div><div className="button-row"><button className="button primary" disabled={busy} onClick={() => vault ? lock() : openAuth()}>{vault ? <LockKeyhole size={16}/> : <UnlockKeyhole size={16}/>} {vault ? 'Lock vault' : hasStored ? 'Unlock vault' : 'Create vault'}</button><button className="button" disabled={!hasStored || busy} onClick={exportBackup}><Download size={16}/> Backup</button></div><button className="text-link restore-link" onClick={() => openAuth('import')} disabled={busy}>Restore encrypted backup <ArrowUpRight size={14}/></button><p className="small-print">Restore replaces this device’s demo state. Export your current backup first. Old backups can restore old demo balances; an onchain implementation must reconcile spent notes against chain state.</p></section><section className="panel settings-panel"><span className="metric-icon green"><Settings2/></span><h2>Projection assumptions</h2><p>These inputs are illustrative, not fetched from Lido or a price oracle. Adjust APR to explore the economics.</p><label className="range-label" htmlFor="apr">Illustrative annual staking rate <strong>{apr.toFixed(1)}%</strong></label><input id="apr" type="range" min="0" max="8" step="0.1" value={apr} onChange={e => setApr(Number(e.target.value))}/><div className="settings-status"><span>Illustrative exchange rate</span><strong>1.20 ETH / wstETH</strong></div><div className="settings-status"><span>Illustrative relayer fee</span><strong>0.0005 wstETH</strong></div><p className="small-print">Simple APR projection; no compounding. Rates can change, losses are possible, and yield may not cover exit costs.</p></section></div><section className="panel notes-panel"><div className="card-top"><div><span className="eyebrow">LOCAL NOTE INVENTORY</span><h2>Your notes</h2></div><FileKey2 size={24}/></div>{activeNotes.length ? activeNotes.map(n => <div className="note-row" key={n.id}><div><strong>{formatAmount(BigInt(n.value), 6)} wstETH</strong><span>Commitment {short(n.commitment)} · {n.status} (demo)</span></div><div className="button-row"><button className="icon-button" aria-label="Copy commitment" onClick={async () => { try { await navigator.clipboard.writeText(n.commitment); setToast('Public commitment copied.'); } catch { setToast('Clipboard unavailable in this browser.'); } }}><Copy size={16}/></button><button className="small-button" onClick={() => setRagequitNote(n)} disabled={busy}>Public exit <ArrowUpRight size={13}/></button></div></div>) : <p className="empty-notes">{vault ? 'No unspent notes. Your next deposit starts here.' : 'Unlock your vault to view notes.'}</p>}<div className="privacy-note"><Info size={17}/><p>Association approval is automatic in this demo. No real screening, anonymity set, or privacy score is claimed. All demo deposits use the placeholder depositor 0x1111…1111.</p></div></section></section>}
    </main>
    <footer><Brand small/><span>Stay private. Keep growing.</span><div><a href="https://github.com/Nakshatra05/YieldVeil" target="_blank" rel="noreferrer">GitHub <ArrowUpRight size={13}/></a><a href="https://x.com/Naksh005" target="_blank" rel="noreferrer">Made by Naksh <ArrowUpRight size={13}/></a><button onClick={() => navigate('settings')} aria-label="Open settings"><Settings2 size={17}/></button></div></footer>
    {toast && <div className="toast" role="status"><Info size={19}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss notification"><X size={17}/></button></div>}
    {auth && <Modal title={auth === 'create' ? 'Make yourself at home.' : auth === 'unlock' ? 'Welcome back.' : 'Restore your demo vault.'} onClose={() => { if (!busy) { setAuth(null); setPassword(''); setConfirmPassword(''); } }}><form onSubmit={authenticate}><p className="dialog-intro">{auth === 'create' ? 'Create a passphrase to encrypt your demo notes on this device. No account, no real funds, no wallet signature.' : auth === 'unlock' ? 'Your notes are encrypted. Enter your passphrase to unlock them locally.' : 'Import an encrypted Yieldveil backup. This replaces the current local demo vault; download a backup first.'}</p>{auth === 'import' && <><button type="button" className="text-link" onClick={exportBackup} disabled={!hasStored}>Download current backup <Download size={14}/></button><label htmlFor="backup">Encrypted backup file</label><input id="backup" type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5_000_000) { setAuthError('File exceeds the 5 MB limit.'); setImportText(''); return; } setImportText(await file.text()); }}/></>}<label htmlFor="passphrase">Passphrase {auth === 'create' && '(12+ characters)'}</label><input id="passphrase" type="password" autoComplete={auth === 'create' ? 'new-password' : 'current-password'} minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/>{auth === 'create' && <><label htmlFor="confirm-passphrase">Confirm passphrase</label><input id="confirm-passphrase" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}/><p className="small-print">Store your passphrase safely. There is no password reset or wallet-signature recovery in this prototype.</p></>}{authError && <p className="form-error" role="alert">{authError}</p>}<button className="button primary full" disabled={busy}>{busy ? <span className="spinner"/> : <LockKeyhole size={17}/>} {busy ? 'Working locally…' : auth === 'create' ? 'Create encrypted demo vault' : auth === 'unlock' ? 'Unlock vault' : 'Replace with backup'}</button></form></Modal>}
    {ragequitNote && <Modal title="Take the public exit?" onClose={() => { if (!busy) setRagequitNote(null); }}><div className="dialog-intro"><p>This simulates returning the entire note ({formatAmount(BigInt(ragequitNote.value), 6)} wstETH) to its original depositor, {short(ragequitNote.depositor)}.</p><p>A real ragequit is public and links the exit to the deposit. It does not require ASP approval. This demo sends no transaction.</p></div><div className="button-row"><button className="button" disabled={busy} onClick={() => setRagequitNote(null)}>Keep my note</button><button className="button primary" disabled={busy} onClick={publicExit}>{busy ? 'Saving…' : 'Simulate public exit'}</button></div></Modal>}
  </>;
}

function YieldChart({ principal, apr, days }: { principal: number; apr: number; days: number }) {
  const gain = projection(principal, apr, days) - principal;
  const maxGain = principal * 0.08;
  const yEnd = 140 - gain / maxGain * 108;
  const points = `M 0 140 L 460 ${yEnd}`;
  return <div className="chart"><div className="chart-y"><span>{(principal + maxGain).toFixed(3)}</span><span>{(principal + maxGain / 2).toFixed(3)}</span><span>{principal.toFixed(3)}</span></div><div className="chart-plot"><svg viewBox="0 0 460 160" preserveAspectRatio="none" role="img" aria-label={`Illustrative projection: ${principal.toFixed(4)} ETH becomes ${(principal + gain).toFixed(4)} ETH in ${days} days at ${apr}% APR.`}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b69ce8" stopOpacity=".45"/><stop offset="100%" stopColor="#b69ce8" stopOpacity=".04"/></linearGradient></defs>{[32,86,140].map(y => <path key={y} d={`M0 ${y}H460`} stroke="#dedbd5" strokeDasharray="4 5"/>)}<path d={`${points} L460 140 Z`} fill="url(#chart-fill)"/><path d="M0 140H460" stroke="#a3a09b" strokeDasharray="5 5" strokeWidth="2"/><path d={points} fill="none" stroke="#8058c4" strokeWidth="3"/><circle cx="456" cy={yEnd + .5} r="4" fill="#8058c4"/></svg><div className="chart-x"><span>Today</span><span>{Math.round(days / 3)} days</span><span>{Math.round(days * 2 / 3)} days</span><span>{days} days</span></div></div></div>;
}
function EmptyState({ icon, title, text, action, onClick }: { icon: ReactNode; title: string; text: string; action: string; onClick: () => void }) { return <div className="empty-state"><span className="empty-icon">{icon}</span><h2>{title}</h2><p>{text}</p><button className="button primary" onClick={onClick}>{action}<ArrowRight size={16}/></button></div>; }

