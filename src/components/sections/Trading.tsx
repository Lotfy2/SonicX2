import React, { useState, useEffect } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
import { Send, ArrowLeftRight, AlertCircle, Loader2, RefreshCw, MessageSquare } from 'lucide-react';
import { getTokenBalance } from '@/services/blockchain';
import { getSwapQuote, executeSwap } from '@/services/dex.ts';

interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'system';
  timestamp: number;
}

// Token addresses
const WUSD_ADDRESS = '0x9e47b13223611871e4b22ba825267667cfcd1559';
const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';

export function Trading() {
  const { isConnected, address } = useAccount();
  const [tokenBalance, setTokenBalance] = useState<{ symbol: string; balance: string; decimals: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<{
    amount: string;
    fromToken: string;
    toToken: string;
    quote: any;
  } | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Native token transfer
  const { sendTransaction } = useSendTransaction();

  useEffect(() => {
    const init = async () => {
      if (address && !initialized) {
        setInitialized(true);
        setMessages([{
          id: `welcome-${Date.now()}`,
          content: 'Welcome to SonicX AI Trading, I\'m an AI Agent that can check balance, send and swap tokens for you.',
          type: 'system',
          timestamp: Date.now()
        }]);
        await loadBalances(false); // Pass false to prevent adding balance message during init
      }
    };

    init();
  }, [address, initialized]);

  const loadBalances = async (showMessage = true) => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    try {
      const sBalance = await getTokenBalance(address);
      setTokenBalance(sBalance);
      if (showMessage) {
        addSystemMessage(`Your balance: ${sBalance.balance} ${sBalance.symbol}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load balances';
      setError(errorMessage);
      if (showMessage) {
        addSystemMessage(`Error: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const generateMessageId = () => {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  };

  const addSystemMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: generateMessageId(),
      content,
      type: 'system',
      timestamp: Date.now()
    }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, {
      id: generateMessageId(),
      content,
      type: 'user',
      timestamp: Date.now()
    }]);
  };

  const handleSendTokens = async (recipientAddress: string, amount: string) => {
    if (!address || !recipientAddress || !amount) return;

    try {
      sendTransaction({
        to: recipientAddress as `0x${string}`,
        value: parseEther(amount)
      });
      
      addSystemMessage(`Initiating transfer of ${amount} S to ${recipientAddress}...`);
    } catch (err) {
      addSystemMessage(`Error: ${err instanceof Error ? err.message : 'Failed to send tokens'}`);
    }
  };

  const handleSwapTokens = async (amount: string, fromToken: string, toToken: string) => {
    if (!address || !amount) return;

    try {
      setProcessing(true);
      
      // Convert token symbols to addresses
      const fromAddress = fromToken.toUpperCase() === 'S' ? NATIVE_ADDRESS : 
                         fromToken.toUpperCase() === 'WUSD' ? WUSD_ADDRESS :
                         null;
      
      const toAddress = toToken.toUpperCase() === 'S' ? NATIVE_ADDRESS :
                       toToken.toUpperCase() === 'WUSD' ? WUSD_ADDRESS :
                       null;

      if (!fromAddress || !toAddress) {
        throw new Error(`Unsupported token pair: ${fromToken}/${toToken}. Only S and WUSD are supported.`);
      }

      // Get quote first
      const quote = await getSwapQuote(fromAddress, toAddress, amount);

      setPendingSwap({ amount, fromToken, toToken, quote });

      addSystemMessage(`
Swap Quote:
• Input: ${quote.inputAmount} ${fromToken}
• Output: ${quote.outputAmount} ${toToken}
• Price: 1 ${fromToken} = ${quote.executionPrice} ${toToken}
• Price Impact: ${quote.priceImpact}%
• Minimum Received: ${quote.minimumReceived} ${toToken}

Would you like to proceed with the swap? Type 'confirm swap' to execute.`);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get swap quote';
      console.error('Swap error:', err);
      addSystemMessage(`Error: ${errorMessage}`);
      setPendingSwap(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmSwap = async () => {
    if (!pendingSwap) {
      addSystemMessage('No pending swap to confirm. Please start a new swap.');
      return;
    }

    try {
      setProcessing(true);
      const txHash = await executeSwap(pendingSwap.quote);
      addSystemMessage(`Swap executed successfully! Transaction: ${txHash}`);
      setPendingSwap(null);
      
      // Refresh balances after swap
      await loadBalances();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to execute swap';
      addSystemMessage(`Error: ${errorMessage}`);
      setPendingSwap(null);
    } finally {
      setProcessing(false);
    }
  };

  const isValidAddress = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const parseCommand = (input: string): { command: string; args: string[] } => {
    const text = input.toLowerCase().trim();
    
    // Direct wallet address input
    if (isValidAddress(text)) {
      return { command: 'balance', args: [text] };
    }
    
    // Check balance patterns
    if (text.match(/^(check|show|what'?s|what is|get|view)\s+(the\s+)?(wallet\s+)?balance(\s+for|\s+of)?\s*$/)) {
      return { command: 'balance', args: [] };
    }

    const balanceMatch = text.match(/^(check|show|what'?s|what is|get|view)\s+(the\s+)?(wallet\s+)?balance(\s+for|\s+of)?\s+(0x[a-fA-F0-9]{40})\s*$/);
    if (balanceMatch && isValidAddress(balanceMatch[5])) {
      return { command: 'balance', args: [balanceMatch[5]] };
    }

    // Send tokens patterns
    const sendMatch = text.match(/^send\s+(\d+\.?\d*)\s*(s)\s+to\s+(0x[a-fA-F0-9]{40})\s*$/i);
    if (sendMatch && isValidAddress(sendMatch[3])) {
      return { command: 'send', args: [sendMatch[3], sendMatch[1]] };
    }

    // Swap tokens patterns
    const swapMatch = text.match(/^swap\s+(\d+\.?\d*)\s*(s|wusd)\s+to\s+(s|wusd)\s*$/i);
    if (swapMatch) {
      return { 
        command: 'swap',
        args: [swapMatch[1], swapMatch[2].toUpperCase(), swapMatch[3].toUpperCase()]
      };
    }

    // Confirm swap pattern
    if (text === 'confirm swap') {
      return { command: 'confirmSwap', args: [] };
    }

    // Help pattern
    if (text.match(/^(help|commands|what can you do|how do I|how to)\s*$/i)) {
      return { command: 'help', args: [] };
    }

    return { command: 'unknown', args: [] };
  };

  const handleCommand = async (input: string) => {
    const { command, args } = parseCommand(input);
    
    addUserMessage(input);
    setProcessing(true);

    try {
      switch (command) {
        case 'balance': {
          const [walletAddress] = args;
          if (walletAddress && !isValidAddress(walletAddress)) {
            addSystemMessage('Invalid wallet address format. Please provide a valid Ethereum address.');
            break;
          }
          
          try {
            const balance = await getTokenBalance(walletAddress || address!);
            addSystemMessage(`Balance: ${balance.balance} ${balance.symbol}`);
          } catch (error) {
            addSystemMessage(`Error checking balance: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          break;
        }

        case 'send': {
          const [recipient, amount] = args;
          if (!recipient || !amount) {
            addSystemMessage('Please specify both recipient address and amount. For example: "send 1 S to 0x..."');
            break;
          }
          if (!isValidAddress(recipient)) {
            addSystemMessage('Invalid recipient address format. Please provide a valid Ethereum address.');
            break;
          }
          await handleSendTokens(recipient, amount);
          break;
        }

        case 'swap': {
          const [amount, fromToken, toToken] = args;
          if (!amount || !fromToken || !toToken) {
            addSystemMessage('Please specify amount and tokens. For example: "swap 1 S to WUSD"');
            break;
          }
          if (fromToken === toToken) {
            addSystemMessage('Cannot swap a token for itself.');
            break;
          }
          await handleSwapTokens(amount, fromToken, toToken);
          break;
        }

        case 'confirmSwap':
          await handleConfirmSwap();
          break;

        case 'help':
          addSystemMessage(`
I can help you with the following:

• Check balance: "check balance" or "check balance for 0x..."
• Send tokens: "send 1 S to 0x..."
• Swap tokens: "swap 1 S to WUSD" or "swap 1 WUSD to S"

You can also directly paste a wallet address to check its balance!`);
          break;

        default:
          addSystemMessage("I didn't understand that command. Try asking for 'help' to see what I can do!");
      }
    } catch (error) {
      addSystemMessage(`Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing) return;

    const command = input.trim();
    setInput('');
    await handleCommand(command);
  };

  if (!isConnected) {
    return (
      <div className="text-center py-12 text-white/60">
        Please connect your wallet to access trading features
      </div>
    );
  }

  return (
    <div className="text-white space-y-8">
      {/* Balance Card */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Your Balance</h3>
          <button
            onClick={() => loadBalances(true)}
            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/20 rounded w-1/2"></div>
          </div>
        ) : error ? (
          <div className="text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        ) : (
          <div>
            <p className="text-2xl font-bold">{tokenBalance?.balance || '0'} S</p>
            <p className="text-sm text-gray-400">Native token</p>
          </div>
        )}
      </div>

      {/* Chat Interface */}
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Trading Assistant</h3>
        </div>

        <div className="h-[400px] overflow-y-auto mb-4 space-y-4 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-3 ${
                  message.type === 'user' ? 'bg-blue-600' : 'bg-white/20'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your request (e.g., 'check balance', 'send 1 S to...', 'swap 1 S to WUSD')"
            className="w-full bg-white/20 rounded-lg px-4 py-2 pr-12 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={processing}
          />
          <button
            type="submit"
            disabled={processing || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white p-2 rounded-lg transition-all disabled:opacity-50"
          >
            {processing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
