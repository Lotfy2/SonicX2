import { ethers } from 'ethers';

const NFT_CONTRACT_ADDRESS = '0x3447B39026144176FF80a8869cFee56243fb6cCe';

const ERC721_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function totalSupply() view returns (uint256)'
];

export interface NFT {
  id: string;
  name: string;
  description: string;
  image: string;
  collection: string;
  tokenId: string;
  explorer?: string;
}

async function getNftBalance(contract: ethers.Contract, walletAddress: string): Promise<number> {
  try {
    const balance = await contract.balanceOf(walletAddress);
    return Number(balance);
  } catch (error) {
    console.error('Error getting NFT balance:', error);
    return 0;
  }
}

async function getWalletNFTs(contract: ethers.Contract, walletAddress: string): Promise<string[]> {
  try {
    const balance = await getNftBalance(contract, walletAddress);
    if (balance === 0) return [];

    // Try to get total supply as a fallback
    let totalSupply = 0;
    try {
      totalSupply = Number(await contract.totalSupply());
    } catch (error) {
      console.warn('Could not get total supply:', error);
    }

    const tokenIds: string[] = [];
    
    // First try using tokenOfOwnerByIndex
    try {
      for (let i = 0; i < balance; i++) {
        const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
        tokenIds.push(tokenId.toString());
      }
    } catch (error) {
      console.warn('tokenOfOwnerByIndex failed, falling back to ownership check:', error);
      
      // Fallback: Check ownership for each token ID up to total supply
      if (totalSupply > 0) {
        for (let i = 1; i <= totalSupply; i++) {
          try {
            const owner = await contract.ownerOf(i);
            if (owner.toLowerCase() === walletAddress.toLowerCase()) {
              tokenIds.push(i.toString());
            }
          } catch (error) {
            continue; // Skip non-existent tokens
          }
        }
      }
    }

    return tokenIds;
  } catch (error) {
    console.error('Error getting wallet NFTs:', error);
    return [];
  }
}

async function getNftMetadata(contract: ethers.Contract, tokenId: string): Promise<{
  name: string;
  description: string;
  image: string;
}> {
  try {
    const tokenUri = await contract.tokenURI(tokenId);
    if (!tokenUri) {
      throw new Error('No token URI found');
    }

    // Handle IPFS URLs
    const url = tokenUri.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${tokenUri.slice(7)}`
      : tokenUri;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch metadata');
    }
    
    const metadata = await response.json();
    
    // Handle IPFS image URLs
    const image = metadata.image?.startsWith('ipfs://')
      ? `https://ipfs.io/ipfs/${metadata.image.slice(7)}`
      : metadata.image || '';

    return {
      name: metadata.name || `NFT #${tokenId}`,
      description: metadata.description || '',
      image
    };
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return {
      name: `NFT #${tokenId}`,
      description: 'Metadata unavailable',
      image: ''
    };
  }
}

export async function fetchWalletNFTs(address?: string): Promise<NFT[]> {
  try {
    if (!address) {
      return [];
    }

    // Validate addresses
    if (!ethers.isAddress(address) || !ethers.isAddress(NFT_CONTRACT_ADDRESS)) {
      console.warn('Invalid address format provided');
      return [];
    }

    const provider = new ethers.JsonRpcProvider('https://rpc.blaze.soniclabs.com');
    const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, ERC721_ABI, provider);
    
    // Get token IDs owned by the wallet
    const tokenIds = await getWalletNFTs(contract, address);
    if (tokenIds.length === 0) {
      return [];
    }

    // Get collection name
    let collectionName = 'Sonic NFT Collection';
    try {
      collectionName = await contract.name();
    } catch (error) {
      console.error('Error fetching collection name:', error);
    }

    // Fetch metadata for all NFTs
    const nftPromises = tokenIds.map(async (tokenId) => {
      try {
        const metadata = await getNftMetadata(contract, tokenId);
        return {
          id: `${NFT_CONTRACT_ADDRESS}-${tokenId}`,
          tokenId,
          name: metadata.name,
          description: metadata.description,
          image: metadata.image,
          collection: collectionName,
          explorer: `https://explorer.blaze.soniclabs.com/token/${NFT_CONTRACT_ADDRESS}/${tokenId}`
        };
      } catch (error) {
        console.error(`Error fetching NFT metadata for token ${tokenId}:`, error);
        return {
          id: `${NFT_CONTRACT_ADDRESS}-${tokenId}`,
          tokenId,
          name: `NFT #${tokenId}`,
          description: 'Failed to load NFT data',
          image: '',
          collection: collectionName,
          explorer: `https://explorer.blaze.soniclabs.com/token/${NFT_CONTRACT_ADDRESS}/${tokenId}`
        };
      }
    });

    const nfts = await Promise.all(nftPromises);
    return nfts.filter(Boolean);
  } catch (error) {
    console.error('Error fetching NFTs:', error);
    return [];
  }
}