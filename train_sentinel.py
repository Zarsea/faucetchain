"""
FaucetChain Sentinel Trainer
============================
Orchestrates the absorption of blockchain data into the Sentinel's vector knowledge base.
"""

import os
import sys
import logging
from FraudAndBonusDetector import SentinelV3Engine

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('trainer')

def train():
    """Main training routine."""
    db_path = "blockchain.db"
    
    if not os.path.exists(db_path):
        logger.error(f"❌ Database file not found at {db_path}")
        logger.info("💡 Make sure indexer_service.py has been run to create the database.")
        sys.exit(1)
        
    logger.info("🚀 Starting Sentinel Training Session...")
    
    # Initialize implementation
    engine = SentinelV3Engine()
    
    # Absorb data
    # We absorb last 50 blocks and 50 transactions for this training session
    engine.absorb_chain_data(db_path, limit=100)
    
    logger.info("🎯 Training session complete!")
    
    # Verification Search
    if engine.kb:
        logger.info("\n=== VERIFICATION SEARCH ===")
        query = "Show me information about recently mined blocks"
        results = engine.kb.search(query, top_k=3)
        
        for i, res in enumerate(results, 1):
            print(f"[{i}] Score: {res['score']:.3f} | Cat: {res['metadata'].get('category')}")
            print(f"    Content: {res['content'][:120]}...\n")

if __name__ == "__main__":
    train()
