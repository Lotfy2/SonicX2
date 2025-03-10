import { createPublicClient, http, parseEther, formatEther } from 'viem';
import { sonicBlazeTestnet } from '../config/chains';

// Configure the public client with proper timeout and retry settings
export const publicClient = createPublicClient({
  chain: sonicBlazeTestnet,
  transport: http('https://rpc.blaze.soniclabs.com', {
    timeout: 20000,
    retryCount: 5,
    retryDelay: 2000,
    batch: {
      wait: 100
    }
  })
});

// ERC20 ABI for token interactions
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' }
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  }
] as const;

export interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 5,
  delay: number = 2000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      if (attempt === maxRetries) break;
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

export async function getTokenBalance(address: string, tokenAddress?: string): Promise<TokenBalance> {
  try {
    if (!address || !address.startsWith('0x') || address.length !== 42) {
      throw new Error('Invalid address format');
    }

    const formattedAddress = address as `0x${string}`;

    if (!tokenAddress) {
      const balance = await retryOperation(
        async () => publicClient.getBalance({ address: formattedAddress })
      );

      return {
        symbol: 'SONIC',
        balance: formatEther(balance),
        decimals: 18
      };
    }

    const formattedTokenAddress = tokenAddress as `0x${string}`;

    const [balance, symbol, decimals] = await Promise.all([
      retryOperation(async () => 
        publicClient.readContract({
          address: formattedTokenAddress,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [formattedAddress]
        })
      ),
      retryOperation(async () =>
        publicClient.readContract({
          address: formattedTokenAddress,
          abi: ERC20_ABI,
          functionName: 'symbol',
          args: []
        })
      ),
      retryOperation(async () =>
        publicClient.readContract({
          address: formattedTokenAddress,
          abi: ERC20_ABI,
          functionName: 'decimals',
          args: []
        })
      )
    ]);

    return {
      symbol,
      balance: formatEther(balance),
      decimals: Number(decimals)
    };
  } catch (error) {
    console.error('Error getting token balance:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error(
      error instanceof Error && error.message
        ? error.message
        : 'Failed to get token balance. Please try again.'
    );
  }
}