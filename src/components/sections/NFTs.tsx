import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { fetchWalletNFTs, NFT } from '../../services/nft';
import { ImageOff, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { ChatSection } from '../ChatSection';

export function NFTs() {
  const { address } = useAccount();
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadNFTs() {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const fetchedNFTs = await fetchWalletNFTs(address);
      setNfts(fetchedNFTs);
    } catch (err) {
      setError('Failed to load NFTs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNFTs();
  }, [address]);

  if (!address) {
    return (
      <div className="text-center py-12 text-white/60">
        Please connect your wallet to view your NFTs
      </div>
    );
  }

  return (
    <div className="text-white space-y-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Your NFTs</h2>
        <button
          onClick={loadNFTs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-white/10 rounded-lg hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-red-400 bg-red-400/20 px-4 py-2 rounded-lg">
          {error}
        </div>
      )}

      {!loading && !error && nfts.length === 0 && (
        <div className="text-center py-12 text-white/60">
          No NFTs found in this wallet
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {nfts.map((nft) => (
          <div
            key={nft.id}
            className="bg-white/5 rounded-lg overflow-hidden hover:bg-white/10 transition-colors"
          >
            <div className="aspect-square relative">
              {nft.image ? (
                <img
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5">
                  <ImageOff className="w-8 h-8 text-white/40" />
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{nft.name || 'Unnamed NFT'}</h3>
                  <p className="text-sm text-white/60">
                    {nft.description || `Token ID: ${nft.tokenId}`}
                  </p>
                </div>
                {nft.explorer && (
                  <a
                    href={nft.explorer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <ChatSection section="nfts" context="NFTs and digital collectibles" />
    </div>
  );
}