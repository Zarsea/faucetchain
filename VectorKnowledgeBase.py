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
    
    # Cada entrada aqui aponta para codigo que existe neste repositorio, e diz
    # onde. O corpus anterior era inventado de ponta a ponta -- BLS, zk-SNARKs,
    # EVM, sharding, bridges para Polygon, auditoria por CertiK e Trail of
    # Bits. O agente respondia isso a quem perguntasse.
    #
    # Se voce acrescentar uma entrada, cite o arquivo. Uma afirmacao sem
    # arquivo e uma afirmacao que ninguem pode conferir, e este assistente ja
    # fez isso o bastante.
    documents = [
        {
            "content": "FaucetChain is a micro-distribution rail. A partner faucet reports a click, every campaign that faucet is enrolled in credits that user from the sponsor's budget, and what is owed becomes a Merkle root published on Solana. The chain's own unit, $CLAIM, is internal accounting; the campaign token is what carries value, because somebody else issued it.",
            "metadata": {"category": "overview", "tags": ["rail", "campaigns", "claim"], "source": "ARCHITECTURE.md"}
        },
        {
            "content": "The guarantee is on Solana, not here. An Anchor program refuses to publish a root its campaign vault cannot cover, so a promise that is not funded never reaches the chain. A user withdraws by presenting a Merkle inclusion proof, and one bit per leaf stops a second withdrawal of the same reward.",
            "metadata": {"category": "settlement", "tags": ["solana", "merkle", "vault"], "source": "faucetchain/programs/faucetchain/src"}
        },
        {
            "content": "Proof of Claim prices a click. The browser solves keccak256 over a message bound to the current chain tip until the digest has 16 leading zero bits, roughly half a second to two seconds of CPU. Difficulty rises by one bit for each quarter of the hourly quota already spent. It is admission control, not chain security: measured in tests/bot_quota_attack.py, one core can solve enough proofs to drain the hour, which is why a per-IP ceiling exists beside it.",
            "metadata": {"category": "consensus", "tags": ["poc", "keccak", "anti-bot"], "source": "api_server.py"}
        },
        {
            "content": "The sealer election picks who seals the next block of native claims. Eligible nodes are those online, weight is 1 + min(active stake, SEALER_STAKE_CAP), and the seed is keccak256 of the parent block hash, so anybody holding the chain recomputes the same result. With no node online the election returns nobody and any caller may seal, which is bootstrap rather than consensus.",
            "metadata": {"category": "consensus", "tags": ["sealer", "stake", "election"], "source": "api_server.py select_block_sealer"}
        },
        {
            "content": "$CLAIM has a maximum supply of 99,000,000 and no halving. Issuance is capped at 2,000 per hour across the whole network, and the minimum withdrawal is 10. It has no price: no market quotes it and nothing in the network requires it yet. Giving it a use is an open design question, not a shipped feature.",
            "metadata": {"category": "token", "tags": ["supply", "quota", "claim"], "source": "api_server.py MAX_SUPPLY"}
        },
        {
            "content": "A partner faucet integrates with one HTTP call: POST /api/faucethub/microclaim with the user's Solana address and an amount, sent after the faucet's own commit and with its error swallowed. If FaucetChain is down the faucet still pays its user. An empty campaigns list in the reply is success, not failure: it means that faucet is enrolled in nothing, or every campaign is out of budget this month.",
            "metadata": {"category": "integration", "tags": ["bridge", "microclaim", "partners"], "source": "integration/README.md"}
        },
        {
            "content": "A user's FaucetChain account is derived from their Solana wallet: the last 20 bytes of keccak256 over the public key. So a partner sends only a public key, nothing else is shared, and the same wallet signing in here reaches the same account. A wallet already linked to another account by signature reaches that one instead, and the lookup returns both so a partner can warn the user.",
            "metadata": {"category": "accounts", "tags": ["derivation", "solana", "linking"], "source": "api_server.py account_reached_by_wallet"}
        },
        {
            "content": "A campaign budget is dripped rather than airdropped. distribution.py computes a per-click rate from what the month still allows, the days left in it, and how many people claimed yesterday, against a floor of 100 users so a small faucet cannot hand each visitor a fifth of the month. Unspent budget rolls into the next month, and the credit never exceeds what the budget still holds.",
            "metadata": {"category": "campaigns", "tags": ["drip", "budget", "distribution"], "source": "distribution.py"}
        },
        {
            "content": "A campaign declares its funding as vault or deferred. Vault means the money is in the Solana vault and the user can withdraw today. Deferred means the project settles at mainnet and the user holds a record of work rather than money. Presenting the two alike is the failure this project exists to fix.",
            "metadata": {"category": "campaigns", "tags": ["funding", "vault", "deferred"], "source": "api_server.py CampaignBudgetRequest"}
        },
        {
            "content": "A user withdraws without ever holding SOL. A relayer builds the transaction, pays the fee and the account rent, and signs alongside the user; the withdrawal can only pay the leaf's own recipient, so the relayer cannot redirect anything. The cost of that subsidy is not yet charged to anyone, and no measurement of it exists.",
            "metadata": {"category": "settlement", "tags": ["relayer", "gasless", "withdrawal"], "source": "api_server.py relay"}
        },
        {
            "content": "Signing in is by Solana wallet, by email, as a guest, or through Telegram once a bot token is configured. Telegram is verified by recomputing its HMAC over the bot token before anything is written. Pasting an address was removed on 24 September: it proved nothing, and although it could never move a balance, it let anyone read any account as though signed in.",
            "metadata": {"category": "accounts", "tags": ["auth", "telegram", "solana"], "source": "social_auth.py"}
        },
        {
            "content": "Every route that changes state relies on one of four things: a signature from the acting wallet, an operator token, a partner API key, or a proof of work. The few that are open by design carry a rate ceiling and are named in test_endpoint_inventory.py with the reason. That test fails the build if a new state-changing route arrives with no guard.",
            "metadata": {"category": "security", "tags": ["authorization", "routes", "ci"], "source": "test_endpoint_inventory.py"}
        },
        {
            "content": "No third party has audited this code. There is no bug bounty, no formal verification, and no audit engagement with any firm. An independent review of the Solana program is recorded as outstanding work in PENDING.md, and until somebody does it, nobody has checked it who did not write it.",
            "metadata": {"category": "security", "tags": ["audit", "review", "status"], "source": "PENDING.md"}
        },
        {
            "content": "The books are checked by reconcile.py, which holds five invariants: nothing mints past the cap, nobody stakes more than exists, no balance goes negative, no claim is counted twice, and the treasury's share of every campaign is accounted for. It runs in CI, and it is what caught 1,495,538 $CLAIM of treasury share that had been credited to nobody.",
            "metadata": {"category": "accounting", "tags": ["reconcile", "invariants", "ci"], "source": "reconcile.py"}
        },
        {
            "content": "The program on Solana devnet is 64LW8DZcrttzaZ5RTTxAytfCGdb3QvDeTq5pUY7WBqSm. It accepts classic SPL mints only: Token-2022 allows a transfer fee, which would debit the vault exactly what the leaf published while the recipient received less, and a root that pays 98 where it said 100 is the guarantee failing quietly.",
            "metadata": {"category": "settlement", "tags": ["devnet", "program", "token-2022"], "source": "create_campaign.rs"}
        },
        {
            "content": "A mining node keeps a machine present on the network and shares the hourly reward by uptime. It does not compute, verify or serve anything, which is worth saying plainly: it is paid for presence. Giving the sealer real work, such as closing the settlement batch and publishing its root, is recorded as design work for after the deadline.",
            "metadata": {"category": "mining", "tags": ["nodes", "uptime", "rewards"], "source": "mining-node/"}
        },
        {
            "content": "There is no P2P network, no virtual machine and no smart contracts on this chain. State lives in SQLite, nodes talk to the sequencer over HTTP, and the only contract in the system runs on Solana. Any description of this project mentioning RocksDB, libp2p, WASM, BLS signatures or zk-SNARKs is describing something else.",
            "metadata": {"category": "architecture", "tags": ["storage", "transport", "scope"], "source": "api_server.py"}
        },
        {
            "content": "FaucetHunter is the first partner faucet, live in production since 26 September 2026. Its bridge calls the micro-claim after its own commit, with a four-second timeout and a circuit breaker that stops trying while FaucetChain is unreachable, so a claim on its side is paid in milliseconds whether or not this network answers.",
            "metadata": {"category": "integration", "tags": ["faucethunter", "production", "bridge"], "source": "integration/faucethunter/"}
        },
        {
            "content": "Fourteen campaigns inherited from testing claimed vault funding while no vault of theirs existed on any chain; two of them named the SPL Token program as sponsor and the Clock sysvar as mint. They were relabelled deferred on 27 September, and the placeholder addresses behind 99% of all issuance were retired the same day, taking recorded supply from 1,208,176 to 11,934.",
            "metadata": {"category": "history", "tags": ["cleanup", "campaigns", "supply"], "source": "scripts/retire_placeholder_ledger.py"}
        },
        {
            "content": "A registered faucet declares how much $CLAIM it is holding for its own users, signed by the wallet that registered it, and the FaucetHub board shows that declaration next to the balance the ledger actually holds. Coverage below 100% means the faucet promised more than it has; no declaration at all reads as undeclared, not as zero. The declaration is a statement and not an escrow: nothing freezes the balance, there is no bond and no penalty, so it is a promise others can check rather than a guarantee.",
            "metadata": {"category": "faucets", "tags": ["reserve", "liquidity", "faucethub"], "source": "api_server.py POST /api/faucethub/reserve"}
        },
        {
            "content": "Nothing in FaucetChain involves betting, wagering or games of chance. A staking screen that debited no balance and a minigame bonus scored in the browser were both removed in September 2026, along with a proof-of-reserve figure that was hardcoded to 100%.",
            "metadata": {"category": "scope", "tags": ["policy", "removed", "honesty"], "source": "ARCHITECTURE.md change log"}
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
