import { lazy, Suspense } from 'react';
import Landing from './Landing';
const VaultApp = lazy(() => import('./VaultApp'));
export default function App() {
  return window.location.pathname.startsWith('/app') ? <Suspense fallback={<div className="loading-screen">Opening your private workspace…</div>}><VaultApp/></Suspense> : <Landing/>;
}
