import { lazy, Suspense } from 'react';
import Landing from './Landing';
const VaultApp = lazy(() => import('./VaultApp'));
const LendingVault = lazy(() => import('./LendingVault'));
const UsdcVault = lazy(() => import('./UsdcVault'));
export default function App() {
  if(window.location.pathname==='/app/usdc/yield')return <Suspense fallback={<div className="loading-screen">Opening your lending vault…</div>}><LendingVault/></Suspense>;
  if(window.location.pathname==='/app/usdc')return <Suspense fallback={<div className="loading-screen">Opening your USDC vault…</div>}><UsdcVault/></Suspense>;
  return window.location.pathname.startsWith('/app') ? <Suspense fallback={<div className="loading-screen">Opening your private workspace…</div>}><VaultApp/></Suspense> : <Landing/>;
}
