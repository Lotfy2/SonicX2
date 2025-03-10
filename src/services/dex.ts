import { createPublicClient, http, parseEther, formatEther, createWalletClient, custom } from 'viem';
import { sonicBlazeTestnet } from '../config/chains';
import { ERC20_ABI } from './blockchain';

// DEX Router for SonicX Testnet
const ROUTER_ADDRESS = '0x0000000000000000000000000000000000000000'; // Will be deployed
const WUSD_ADDRESS = '0x9e47b13223611871e4b22ba825267667cfcd1559';
const WSONIC_ADDRESS = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

// Uniswap V2 style Router ABI
const ROUTER_ABI = [
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' }
    ],
    name: 'getAmountsOut',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactSONICForTokens',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' }
    ],
    name: 'swapExactTokensForSONIC',
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

// Configure the client
const publicClient = createPublicClient({
  chain: sonicBlazeTestnet,
  transport: http('https://rpc.blaze.soniclabs.com', {
    timeout: 20000,
    retryCount: 3,
    retryDelay: 1000,
    batch: { wait: 100 }
  })
});

export interface SwapQuote {
  inputAmount: string;
  outputAmount: string;
  executionPrice: string;
  priceImpact: string;
  minimumReceived: string;
  route: {
    from: string;
    to: string;
    path: string[];
  };
}

// Mock liquidity data for development
const MOCK_RESERVES = {
  [WSONIC_ADDRESS]: '1000000000000000000000',  // 1000 SONIC
  [WUSD_ADDRESS]: '1500000000000000000000'     // 1500 WUSD
};

function calculatePriceImpact(amountIn: bigint, amountOut: bigint): string {
  try {
    const impact = ((Number(amountIn) - Number(amountOut)) / Number(amountIn)) * 100;
    return impact.toFixed(2);
  } catch (error) {
    console.error('Error calculating price impact:', error);
    return '0.00';
  }
}

export async function getSwapQuote(
  inputToken: string,
  outputToken: string,
  amount: string
): Promise<SwapQuote> {
  try {
    const inputAmount = parseEther(amount);
    const path = [inputToken, outputToken];

    // Mock the getAmountsOut call
    const outputAmount = BigInt(Math.floor(Number(inputAmount) * 0.98)); // 2% slippage
    const executionPrice = 0.98; // 1 input = 0.98 output
    const minimumReceived = (outputAmount * BigInt(995)) / BigInt(1000); // 0.5% slippage

    return {
      inputAmount: amount,
      outputAmount: formatEther(outputAmount),
      executionPrice: executionPrice.toFixed(6),
      priceImpact: '2.00',
      minimumReceived: formatEther(minimumReceived),
      route: { from: inputToken, to: outputToken, path }
    };
  } catch (error) {
    console.error('Error getting swap quote:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get swap quote');
  }
}

export async function executeSwap(quote: SwapQuote): Promise<string> {
  try {
    if (!window.ethereum) {
      throw new Error('No Web3 provider found');
    }

    const walletClient = createWalletClient({
      chain: sonicBlazeTestnet,
      transport: custom(window.ethereum)
    });

    const [account] = await walletClient.requestAddresses();
    if (!account) {
      throw new Error('No account found');
    }

    const inputAmount = parseEther(quote.inputAmount);
    const minOutput = parseEther(quote.minimumReceived);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200); // 20 minutes

    let txHash: `0x${string}`;

    if (quote.route.from === '0x0000000000000000000000000000000000000000') {
      // Swapping SONIC for tokens
      txHash = await walletClient.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'swapExactSONICForTokens',
        args: [minOutput, quote.route.path, account, deadline],
        value: inputAmount
      });
    } else {
      // Swapping tokens for SONIC
      const approvalHash = await walletClient.writeContract({
        address: quote.route.from as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ROUTER_ADDRESS, inputAmount]
      });

      await publicClient.waitForTransactionReceipt({ 
        hash: approvalHash,
        timeout: 60_000
      });

      txHash = await walletClient.writeContract({
        address: ROUTER_ADDRESS as `0x${string}`,
        abi: ROUTER_ABI,
        functionName: 'swapExactTokensForSONIC',
        args: [inputAmount, minOutput, quote.route.path, account, deadline]
      });
    }

    const receipt = await publicClient.waitForTransactionReceipt({ 
      hash: txHash,
      timeout: 60_000
    });
    
    if (!receipt.status) {
      throw new Error('Transaction reverted');
    }

    return txHash;
  } catch (error) {
    console.error('Error executing swap:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to execute swap');
  }
}
