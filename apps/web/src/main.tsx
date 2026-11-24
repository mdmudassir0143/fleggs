import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { DAppKitProvider } from '@mysten/dapp-kit-react';
import { dAppKit } from './dappKit';
import { App } from './App';
import { ToastProvider } from './ui/Toast';
import { Landing } from './screens/Landing';

import './css/tokens.css';
import './css/base.css';
import './css/components.css';
import './css/screens.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DAppKitProvider dAppKit={dAppKit}>
    </DAppKitProvider>
  </StrictMode>,
);
