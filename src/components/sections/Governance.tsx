import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Link2, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';
import { ChatSection } from '../ChatSection';

export function Governance() {
  const { address } = useAccount();

  if (!address) {
    return (
      <div className="text-center py-12 text-white/60">
        Please connect your wallet to access governance features
      </div>
    );
  }

  return (
    <div className="text-white space-y-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Governance</h1>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Active Proposals</h2>
          <div className="text-center py-8 text-gray-400">
            No active proposals at this time
          </div>
        </div>

        <ChatSection section="governance" context="blockchain governance and proposals" />
      </div>
    </div>
  );
}