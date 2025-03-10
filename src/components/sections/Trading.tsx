import React, { useState, useEffect } from 'react';
import { useAccount, useContractWrite, usePrepareContractWrite, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
import { Send, ArrowLeftRight, AlertCircle, Loader2, RefreshCw, MessageSquare } from 'lucide-react';
import { getTokenBalance, ERC20_ABI } from '../../services/blockchain';

interface ChatMessage {
  id: string;
  content: string;
  type: 'user' | 'system';
  timestamp: number;
}

export function Trading() {
  const { isConnected, address } = useAccount();
  const [tokenBalance, setTokenBalance] = useState<{ symbol: string; balance: string; decimals: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [sendState, setSendState] = useState({
    to: '',
    amount: '',
    tokenAddress: ''
  });

  // Native token transfer
  const { data: sendData, sendTransaction, isLoading: isSending } = useSendTransaction();

  // ERC20 token transfer
  const { config: tokenConfig } = usePrepareContractWrite({
    address: sendState.tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: sendState.to && sendState.amount ? [
      sendState.to as `0x${string}`,
      parseEther(sendState.amount)
    ] : undefined,
    enabled: Boolean(sendState.to && sendState.amount && sendState.tokenAddress)
  });

  const { write: sendToken, isLoading: isTokenSending } = useContractWrite(tokenConfig);

  useEffect(() => {
    if (address) {
      loadBalance();
      addSystemMessage('Welcome to Sonic Trading! I can help you check balances, send tokens, and swap. Just ask me in natural language!');
    }
  }, [address]);

  const loadBalance = async (walletAddress?: string) => {
    const targetAddress = walletAddress || address;
    if (!targetAddress) return;
    
    setLoading(true);
    setError(null);
    try {
      const balance = await getTokenBalance(targetAddress);
      if (!walletAddress) {
        setTokenBalance(balance);
      }
      return balance;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load balance';
      setError(errorMessage);
      return null;
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

  const handleSendTokens = async (recipientAddress: string, amount: string, tokenAddress?: string) => {
    if (!address || !recipientAddress || !amount) return;

    try {
      if (tokenAddress) {
        // Send ERC20 tokens
        setSendState({
          to: recipientAddress,
          amount,
          tokenAddress
        });
        sendToken?.();
      } else {
        // Send native tokens
        sendTransaction({
          to: recipientAddress,
          value: parseEther(amount)
        });
      }
    } catch (err) {
      addSystemMessage(`Error: ${err instanceof Error ? err.message : 'Failed to send tokens'}`);
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
    const sendMatch = text.match(/^send\s+(\d+\.?\d*)\s*(sonic|s)\s+to\s+(0x[a-fA-F0-9]{40})\s*$/i);
    if (sendMatch && isValidAddress(sendMatch[3])) {
      return { command: 'send', args: [sendMatch[3], sendMatch[1]] };
    }

    // Swap patterns
    const swapMatch = text.match(/^swap\s+(\d+\.?\d*)\s*(sonic|s)(\s+for\s+(\w+))?\s*$/i);
    if (swapMatch) {
      return { command: 'swap', args: [swapMatch[1], swapMatch[4] || 'USDC'] };
    }

    // Help pattern
    if (text.match(/^(help|commands|what can you do|how do I|how to)\s*$/i)) {
      return { command: 'help', args: [] };
    }

    // Extract wallet address if present anywhere in the text
    const addressMatch = text.match(/(0x[a-fA-F0-9]{40})/);
    if (addressMatch && isValidAddress(addressMatch[1])) {
      return { command: 'balance', args: [addressMatch[1]] };
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
          const balance = await loadBalance(walletAddress);
          if (balance) {
            addSystemMessage(
              walletAddress
                ? `Balance for ${walletAddress}: ${balance.balance} ${balance.symbol}`
                : `Your balance: ${balance.balance} ${balance.symbol}`
            );
          }
          break;
        }

        case 'send': {
          const [recipient, amount] = args;
          if (!recipient || !amount) {
            addSystemMessage('Please specify both recipient address and amount. For example: "send 1 SONIC to 0x..."');
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
          const [amount, targetToken] = args;
          addSystemMessage(`Swap functionality for ${amount} SONIC to ${targetToken} coming soon!`);
          break;
        }

        case 'help':
          addSystemMessage(`
I can help you with the following:

• Check balance: "check balance" or "check balance for 0x..."
• Send tokens: "send 1 SONIC to 0x..."
• Swap tokens: "swap 1 SONIC for USDC" (coming soon)

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Balance Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Your Balance</h3>
            <button
              onClick={() => loadBalance()}
              className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-white/20 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-white/20 rounded w-1/3"></div>
            </div>
          ) : error ? (
            <div className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          ) : tokenBalance ? (
            <div>
              <p className="text-2xl font-bold">{tokenBalance.balance} {tokenBalance.symbol}</p>
              <p className="text-sm text-gray-400">Available to trade</p>
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleCommand('send 0 SONIC to 0x0000000000000000000000000000000000000000')}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors rounded-lg p-4"
              disabled={isSending || isTokenSending}
            >
              {isSending || isTokenSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              <span>Send</span>
            </button>
            <button
              onClick={() => handleCommand('swap 0 SONIC for USDC')}
              className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 transition-colors rounded-lg p-4"
            >
              <ArrowLeftRight className="w-5 h-5" />
              <span>Swap</span>
            </button>
          </div>
        </div>
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
            placeholder="Type your request (e.g., 'check balance', 'send 1 SONIC to...')"
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