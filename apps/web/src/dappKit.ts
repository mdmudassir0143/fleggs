import { createDAppKit } from '@mysten/dapp-kit-react';
import { registerEnokiWallets } from '@mysten/enoki';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { ENOKI_API_KEY, GOOGLE_CLIENT_ID } from './config';

export const dAppKit = createDAppKit({
  networks: ['testnet'],
  defaultNetwork: 'testnet',
  slushWalletConfig: null, // Google sign-in only; also avoids a blocked metadata fetch
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: 'https://fullnode.testnet.sui.io:443' }),
});

registerEnokiWallets({
  apiKey: ENOKI_API_KEY,
  // Fixed redirect (site origin, no path) so it always matches the URIs registered in Google Cloud.
  providers: {
    // email: so the waitlist can match an approved player to their sign-in (see lib/access.ts).
    google: { clientId: GOOGLE_CLIENT_ID, redirectUrl: window.location.origin, extraParams: { scope: 'email' } },
  },
  clients: [dAppKit.getClient('testnet')],
  getCurrentNetwork: () => dAppKit.stores.$currentNetwork.get(),
});

declare module '@mysten/dapp-kit-react' {
  interface Register { dAppKit: typeof dAppKit }
}
