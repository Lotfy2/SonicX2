import { defineChain } from 'viem';

export const sonicBlazeTestnet = defineChain({
  id: 57054,
  name: 'Sonic Blaze Testnet',
  network: 'sonic-blaze-testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'SONIC',
    symbol: 'SONIC',
  },
  rpcUrls: {
    default: { http: ['https://rpc.blaze.soniclabs.com'] },
    public: { http: ['https://rpc.blaze.soniclabs.com'] },
  },
  blockExplorers: {
    default: { name: 'Sonic Blaze Explorer', url: 'https://explorer.blaze.soniclabs.com' },
  },
  contracts: {
    multicall3: {
      address: '0xcA11bde05977b3631167028862bE2a173976CA11',
      blockCreated: 11_907_934,
    },
  },
});