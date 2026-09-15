"""
FaucetChain Vector Knowledge Base
==================================
Semantic search system for universal question answering.
"""

import json
import hashlib
from typing import List, Dict, Optional
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.config import Settings


class VectorKnowledgeBase:
    """
    Vector database for semantic search over FaucetChain documentation.
    Uses ChromaDB for storage and Sentence-Transformers for embeddings.
    """
    
    def __init__(self, persist_directory: str = "./knowledge_db"):
        """Initialize the vector database."""
        self.model = SentenceTransformer('all-MiniLM-L6-v2')  # 384-dim embeddings
        
        self.client = chromadb.PersistentClient(path=persist_directory)
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="faucetchain_knowledge",
            metadata={"description": "FaucetChain protocol knowledge base"}
        )
    
    def add_document(
        self, 
        content: str, 
        metadata: Optional[Dict] = None,
        doc_id: Optional[str] = None
    ) -> str:
        """
        Add a document to the knowledge base.
        
        Args:
            content: Text content to index
            metadata: Optional metadata (category, tags, etc.)
            doc_id: Optional custom ID (auto-generated if not provided)
            
        Returns:
            Document ID
        """
        if not doc_id:
            doc_id = self._generate_id(content)
        
        # Generate embedding
        embedding = self.model.encode(content).tolist()
        
        # Add to collection
        self.collection.add(
            ids=[doc_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}]
        )
        
        return doc_id
    
    def add_documents_batch(self, documents: List[Dict]) -> List[str]:
        """
        Add multiple documents at once (more efficient).
        
        Args:
            documents: List of dicts with 'content', 'metadata', 'id' (optional)
            
        Returns:
            List of document IDs
        """
        ids = []
        contents = []
        metadatas = []
        
        for doc in documents:
            doc_id = doc.get('id') or self._generate_id(doc['content'])
            ids.append(doc_id)
            contents.append(doc['content'])
            metadatas.append(doc.get('metadata', {}))
        
        # Batch encode
        embeddings = self.model.encode(contents).tolist()
        
        # Batch add
        self.collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=contents,
            metadatas=metadatas
        )
        
        return ids
    
    def search(
        self, 
        query: str, 
        top_k: int = 3,
        filter_metadata: Optional[Dict] = None
    ) -> List[Dict]:
        """
        Semantic search for relevant documents.
        
        Args:
            query: User question
            top_k: Number of results to return
            filter_metadata: Optional metadata filter (e.g., {"category": "consensus"})
            
        Returns:
            List of results with content, metadata, and similarity score
        """
        # Generate query embedding
        query_embedding = self.model.encode(query).tolist()
        
        # Search
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter_metadata
        )
        
        # Format results
        formatted = []
        for i in range(len(results['ids'][0])):
            formatted.append({
                'id': results['ids'][0][i],
                'content': results['documents'][0][i],
                'metadata': results['metadatas'][0][i],
                'score': 1.0 - results['distances'][0][i]  # Convert distance to similarity
            })
        
        return formatted
    
    def delete_document(self, doc_id: str):
        """Delete a document by ID."""
        self.collection.delete(ids=[doc_id])
    
    def get_stats(self) -> Dict:
        """Get database statistics."""
        count = self.collection.count()
        return {
            "total_documents": count,
            "embedding_dimension": 384,
            "model": "all-MiniLM-L6-v2"
        }
    
    def _generate_id(self, content: str) -> str:
        """Generate a unique ID from content hash."""
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def add_block_to_kb(self, block_data: Dict) -> str:
        """
        Formats and adds a blockchain block to the knowledge base.
        
        Args:
            block_data: {height, hash, validator, tx_count, timestamp}
        """
        content = (
            f"Block #{block_data['height']} was mined by validator {block_data['validator']} "
            f"at timestamp {block_data['timestamp']}. It contains {block_data['tx_count']} transactions. "
            f"Block hash: {block_data['hash']}."
        )
        metadata = {
            "category": "blockchain_data",
            "type": "block",
            "height": block_data['height'],
            "validator": block_data['validator']
        }
        return self.add_document(content, metadata, f"block_{block_data['height']}")

    def add_transaction_to_kb(self, tx_data: Dict) -> str:
        """
        Formats and adds a blockchain transaction to the knowledge base.
        
        Args:
            tx_data: {hash, from_address, to_address, value, gas_price, timestamp}
        """
        content = (
            f"Transaction {tx_data['hash']} moved {tx_data['value']} tokens from "
            f"{tx_data['from_address']} to {tx_data['to_address']} at timestamp {tx_data['timestamp']}. "
            f"Gas price: {tx_data['gas_price']} gwei."
        )
        metadata = {
            "category": "blockchain_data",
            "type": "transaction",
            "from": tx_data['from_address'],
            "to": tx_data['to_address'],
            "value": tx_data['value']
        }
        return self.add_document(content, metadata, f"tx_{tx_data['hash'][:12]}")


# Example: Seed the database with FaucetChain knowledge
def seed_knowledge_base():
    """Populate the database with initial FaucetChain documentation."""
    kb = VectorKnowledgeBase()
    
    documents = [
        {
            "content": "FaucetChain uses a Hybrid Consensus mechanism combining Proof of Stake (PoS) for financial security and Proof of Carrier (PoC) for network utility validation. Validators must both stake tokens and route real network traffic to earn rewards.",
            "metadata": {"category": "consensus", "tags": ["pos", "poc", "hybrid"]}
        },
        {
            "content": "The Merit Weight formula is: MW = ln(stake_amount) * uptime_coefficient * traffic_volume. This logarithmic approach prevents whale dominance while rewarding active network participation.",
            "metadata": {"category": "validators", "tags": ["merit", "formula", "economics"]}
        },
        {
            "content": "FaucetChain implements native L1 consensus with optimistic rollup-style batching. Transactions are processed on-chain every 100 blocks with a 7-day fraud proof challenge period, achieving high throughput with maximum security.",
            "metadata": {"category": "scaling", "tags": ["layer1", "consensus", "faucetchain"]}
        },
        {
            "content": "$CLAIM token has a maximum supply of 21 million with halving every 210,000 blocks. Initial emission is 100 tokens per block. 50% of gas fees are burned for deflation.",
            "metadata": {"category": "tokenomics", "tags": ["claim", "supply", "halving"]}
        },
        {
            "content": "The SentinelV3Engine fraud detection system uses temporal analysis, gas price uniformity detection, and compression-based pattern matching to identify Sybil attacks. Flagged nodes receive 0.1x multiplier penalty.",
            "metadata": {"category": "security", "tags": ["fraud", "sybil", "ml"]}
        },
        {
            "content": "Validators earn bonus multipliers from 1.0x to 2.5x based on DeFi activity: 30% liquidity provision, 20% protocol diversity, 30% transaction volume, 20% uptime.",
            "metadata": {"category": "rewards", "tags": ["bonus", "defi", "validators"]}
        },
        {
            "content": "FaucetChain V3 Merit Faucet allows claiming test tokens via native FaucetChain transactions. Each claim generates a verifiable hash and creates a new application block.",
            "metadata": {"category": "faucet", "tags": ["claim", "network", "faucetchain"]}
        },
        {
            "content": "Block production targets 12-second intervals matching Ethereum. Soft finality is instant, hard finality occurs after L1 checkpoint (~20 minutes, every 100 blocks).",
            "metadata": {"category": "consensus", "tags": ["blocks", "finality", "timing"]}
        },
        {
            "content": "Gas fees use dynamic adjustment based on congestion. Base fee implements EIP-1559 with 50% burn and 50% to validators. Current network average is around 25 gwei.",
            "metadata": {"category": "economics", "tags": ["gas", "fees", "eip1559"]}
        },
        {
            "content": "To become a validator, stake $CLAIM tokens and maintain >99% uptime. Slashing penalty is 1% stake per hour of downtime. Minimum stake requirement is 1000 $CLAIM.",
            "metadata": {"category": "validators", "tags": ["staking", "requirements", "slashing"]}
        },
        {
            "content": "FaucetChain supports ERC-20 token standards and is compatible with existing Ethereum tooling like MetaMask, Hardhat, and Ethers.js. Smart contracts can be deployed using Solidity or Vyper.",
            "metadata": {"category": "development", "tags": ["erc20", "compatibility", "tools"]}
        },
        {
            "content": "Network upgrades follow a governance process where validators vote on proposals. A 66% supermajority is required for protocol changes. Emergency upgrades can be fast-tracked with 80% consensus.",
            "metadata": {"category": "governance", "tags": ["voting", "upgrades", "dao"]}
        },
        {
            "content": "Cross-chain bridges to Ethereum mainnet, Polygon, and Arbitrum are planned for Q2 2026. These will use optimistic verification with 7-day challenge periods for maximum security.",
            "metadata": {"category": "roadmap", "tags": ["bridges", "cross-chain", "future"]}
        },
        {
            "content": "The Proof of Claim (PoC) (PoC) aggregates validator votes using BLS signatures, reducing on-chain storage by 90%. This allows for thousands of validators without blockchain bloat.",
            "metadata": {"category": "consensus", "tags": ["hvm", "bls", "scalability"]}
        },
        {
            "content": "FaucetChain faucet provides 100 test $CLAIM tokens per claim with a 24-hour cooldown. The network uses zero gas fees for claims. Mainnet launch is scheduled for Q3 2026.",
            "metadata": {"category": "faucet", "tags": ["testnet", "tokens", "mainnet"]}
        },
        {
            "content": "Smart contract security is ensured through mandatory audits by CertiK and Trail of Bits. All contracts undergo formal verification before deployment. Bug bounty program offers up to $100k for critical vulnerabilities.",
            "metadata": {"category": "security", "tags": ["audits", "bounty", "verification"]}
        },
        {
            "content": "Transaction privacy can be enhanced using zk-SNARKs for confidential transfers. This is optional and incurs a 2x gas fee premium. Privacy pools are isolated from public transactions.",
            "metadata": {"category": "privacy", "tags": ["zk-snarks", "confidential", "privacy"]}
        },
        {
            "content": "Validator node requirements: 4 CPU cores, 16GB RAM, 500GB SSD, 100 Mbps internet. Recommended OS: Ubuntu 22.04 LTS. Docker images are provided for easy deployment.",
            "metadata": {"category": "infrastructure", "tags": ["requirements", "hardware", "deployment"]}
        },
        {
            "content": "DeFi protocols on FaucetChain include native DEX (FaucetSwap), lending platform (MeritLend), and liquid staking (StakeClaim). Total Value Locked (TVL) currently at $5M testnet.",
            "metadata": {"category": "defi", "tags": ["dex", "lending", "tvl"]}
        },
        {
            "content": "MEV (Maximal Extractable Value) protection uses encrypted mempools and fair ordering via Chainlink FSS. Validators cannot reorder transactions for profit. Frontrunning is cryptographically prevented.",
            "metadata": {"category": "security", "tags": ["mev", "fairness", "chainlink"]}
        }
    ]
    
    ids = kb.add_documents_batch(documents)
    print(f"✅ Seeded {len(ids)} documents to knowledge base")
    print(f"📊 Stats: {kb.get_stats()}")
    
    return kb


# Example usage and testing
if __name__ == "__main__":
    print("=== FaucetChain Vector Knowledge Base ===\n")
    
    # Seed database
    kb = seed_knowledge_base()
    
    print("\n=== TESTING SEMANTIC SEARCH ===\n")
    
    # Test queries
    test_queries = [
        "How does the consensus mechanism work?",
        "What is the token supply?",
        "How do I become a validator?",
        "Explain fraud detection",
        "Como funciona o faucet?"
    ]
    
    for query in test_queries:
        print(f"Query: '{query}'")
        results = kb.search(query, top_k=2)
        
        for i, result in enumerate(results, 1):
            print(f"  [{i}] Score: {result['score']:.3f}")
            print(f"      Category: {result['metadata'].get('category', 'N/A')}")
            print(f"      Content: {result['content'][:100]}...")
        print()
