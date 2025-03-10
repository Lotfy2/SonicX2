import { request, gql } from 'graphql-request';

const SONIC_ENDPOINT = 'https://api.sonic.network/graphql';

export interface BlockchainData {
  transactions: {
    hash: string;
    from: string;
    to: string;
    value: string;
    timestamp: string;
  }[];
  tokenTransfers: {
    token: {
      symbol: string;
    };
    amount: string;
    from: string;
    to: string;
  }[];
  whaleAccounts: {
    address: string;
    balance: string;
  }[];
}

export interface MarketTrend {
  symbol: string;
  trend: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  whaleActivity: {
    buys: number;
    sells: number;
    netFlow: string;
  };
  priceImpact: {
    predicted: number;
    confidence: number;
  };
}

const blockchainQuery = gql`
  query GetBlockchainData {
    blockchain(network: "Sonic") {
      transactions(limit: 100, orderBy: { timestamp: desc }) {
        hash
        from
        to
        value
        timestamp
      }
      tokenTransfers(limit: 100, orderBy: { timestamp: desc }) {
        token {
          symbol
        }
        amount
        from
        to
      }
      accounts(limit: 10, orderBy: { balance: desc }) {
        address
        balance
      }
    }
  }
`;

export async function fetchBlockchainData(): Promise<BlockchainData> {
  try {
    const data = await request(SONIC_ENDPOINT, blockchainQuery);
    return data.blockchain;
  } catch (error) {
    console.error('Error fetching blockchain data:', error);
    throw new Error('Failed to fetch blockchain data');
  }
}

function analyzeWhaleActivity(data: BlockchainData, symbol: string): MarketTrend['whaleActivity'] {
  const transfers = data.tokenTransfers.filter(t => t.token.symbol === symbol);
  const whaleAddresses = new Set(data.whaleAccounts.map(w => w.address.toLowerCase()));
  
  let buys = 0;
  let sells = 0;
  let netFlow = BigInt(0);

  transfers.forEach(transfer => {
    const isWhaleFrom = whaleAddresses.has(transfer.from.toLowerCase());
    const isWhaleTo = whaleAddresses.has(transfer.to.toLowerCase());
    const amount = BigInt(transfer.amount);

    if (isWhaleFrom && !isWhaleTo) {
      sells++;
      netFlow -= amount;
    } else if (!isWhaleFrom && isWhaleTo) {
      buys++;
      netFlow += amount;
    }
  });

  return {
    buys,
    sells,
    netFlow: netFlow.toString()
  };
}

function calculatePriceImpact(
  whaleActivity: MarketTrend['whaleActivity'],
  currentPrice: number
): MarketTrend['priceImpact'] {
  const netFlowNum = Number(whaleActivity.netFlow);
  const impactFactor = 0.0001; // 0.01% impact per unit of net flow
  const predictedChange = netFlowNum * impactFactor;
  
  const confidence = Math.min(
    Math.max(
      (Math.abs(whaleActivity.buys - whaleActivity.sells) / 
      (whaleActivity.buys + whaleActivity.sells)) * 100,
      60
    ),
    95
  );

  return {
    predicted: currentPrice * (1 + predictedChange),
    confidence
  };
}

export async function analyzeMarketTrends(symbol: string, currentPrice: number): Promise<MarketTrend> {
  const data = await fetchBlockchainData();
  const whaleActivity = analyzeWhaleActivity(data, symbol);
  const priceImpact = calculatePriceImpact(whaleActivity, currentPrice);

  // Determine trend based on whale activity and price impact
  let trend: MarketTrend['trend'] = 'neutral';
  let confidence = priceImpact.confidence;

  if (whaleActivity.buys > whaleActivity.sells * 1.5) {
    trend = 'bullish';
    confidence = Math.min(confidence + 10, 95);
  } else if (whaleActivity.sells > whaleActivity.buys * 1.5) {
    trend = 'bearish';
    confidence = Math.min(confidence + 10, 95);
  }

  return {
    symbol,
    trend,
    confidence,
    whaleActivity,
    priceImpact
  };
}