"""
FaucetChain Sentinel V3 - Fraud Detection & Bonus Calculation Engine
=====================================================================
Machine Learning module for detecting Sybil attacks and calculating validator bonuses.
"""

import zlib
import time
import hashlib
import sqlite3
import logging
from typing import List, Dict, Tuple
from collections import Counter
from datetime import datetime, timedelta

try:
    from VectorKnowledgeBase import VectorKnowledgeBase
    HAS_KB = True
except ImportError:
    HAS_KB = False

# Configure logging for Sentinel
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('sentinel')


class FraudDetector:
    """Detects anomalous patterns indicative of claim farming and Sybil attacks."""
    
    def __init__(self):
        self.sybil_threshold = 0.75  # 75% similarity triggers flag
        self.min_claim_interval = 60  # Minimum seconds between legitimate claims
        
    def is_sybil_pattern(self, claim_sequence: List[Dict]) -> bool:
        """
        Detects if a claim sequence exhibits Sybil attack patterns.
        
        Indicators:
        - Claims too frequent (< 60s apart)
        - Repetitive transaction patterns
        - Identical gas prices across multiple claims
        - Sequential nonce patterns from different addresses
        """
        if len(claim_sequence) < 3:
            return False
            
        # Check 1: Temporal Analysis
        # Sort timestamps ascending to calculate positive intervals
        timestamps = sorted([claim.get('timestamp', 0) for claim in claim_sequence])
        intervals = [timestamps[i+1] - timestamps[i] for i in range(len(timestamps)-1)]
        
        if intervals and min(intervals) < self.min_claim_interval:
            return True  # Claims too fast
            
        # Check 2: Gas Price Uniformity / Narrow Band
        gas_prices = [claim.get('gasPrice', 0) for claim in claim_sequence]
        if len(gas_prices) > 5 and max(gas_prices) > 0:
            gas_range = max(gas_prices) - min(gas_prices)
            if gas_range < 0.5:
                return True  # Suspicious uniformity (immune to minor jitter)
            
        # Check 3: Pattern Similarity (using compression ratio)
        pattern_string = self._compute_pattern_string(claim_sequence)
        similarity = self._calculate_similarity(pattern_string)
        
        return similarity > self.sybil_threshold
    
    def _compute_pattern_string(self, claims: List[Dict]) -> str:
        """Creates a coarse fingerprint of claim behavior to defeat jitter."""
        pattern = ''.join([
            f"{int(round(claim.get('amount', 0), -1))}_" + 
            f"{int(round(claim.get('gasPrice', 0), 0))}|" 
            for claim in claims
        ])
        return pattern
    
    def _calculate_similarity(self, pattern_string: str) -> float:
        """Uses compression ratio to detect repetitive patterns."""
        if not pattern_string or len(pattern_string) < 40:
            return 0.0
            
        compressed = zlib.compress(pattern_string.encode())
        ratio = len(compressed) / len(pattern_string.encode())
        
        # If the string compresses very well (low ratio), it's highly repetitive.
        return max(0.0, 1.0 - ratio)


class BonusCalculator:
    """Calculates activity bonuses for validators participating in DeFi."""
    
    def __init__(self):
        self.base_bonus = 1.0
        self.max_bonus = 2.5
        
    def calculate_defi_bonus(self, validator_data: Dict) -> float:
        """
        Calculates bonus multiplier based on DeFi activity.
        
        Factors:
        - Liquidity provided to pools
        - Number of unique protocols interacted with
        - Volume of transactions routed
        - Uptime consistency
        """
        liquidity_score = self._score_liquidity(validator_data.get('liquidity', 0))
        protocol_diversity = self._score_protocol_diversity(validator_data.get('protocols', []))
        volume_score = self._score_volume(validator_data.get('volume', 0))
        uptime_score = validator_data.get('uptime', 0.99)
        
        # Weighted average
        bonus = (
            liquidity_score * 0.3 +
            protocol_diversity * 0.2 +
            volume_score * 0.3 +
            uptime_score * 0.2
        )
        
        return min(self.base_bonus + bonus, self.max_bonus)
    
    def _score_liquidity(self, liquidity_usd: float) -> float:
        """Scores liquidity provision (0-1 scale)."""
        if liquidity_usd < 1000:
            return 0.0
        elif liquidity_usd < 10000:
            return 0.3
        elif liquidity_usd < 100000:
            return 0.7
        else:
            return 1.0
    
    def _score_protocol_diversity(self, protocols: List[str]) -> float:
        """Rewards interaction with multiple DeFi protocols."""
        unique_protocols = len(set(protocols))
        return min(unique_protocols / 5.0, 1.0)  # Max at 5 protocols
    
    def _score_volume(self, volume_usd: float) -> float:
        """Scores transaction volume routed."""
        if volume_usd < 5000:
            return 0.0
        elif volume_usd < 50000:
            return 0.4
        elif volume_usd < 500000:
            return 0.8
        else:
            return 1.0


class SentinelV3Engine:
    """Main engine combining fraud detection and bonus calculation."""
    
    def __init__(self):
        self.detector = FraudDetector()
        self.bonus_calc = BonusCalculator()
        self.audit_log = []
        self.kb = VectorKnowledgeBase() if HAS_KB else None
        
    def absorb_chain_data(self, db_path: str, limit: int = 100):
        """
        Extracts recent blockchain data and indexes it into the vector knowledge base.
        """
        if not self.kb:
            logger.warning("⚠️ Vector Knowledge Base not available for absorption.")
            return

        try:
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()

            # Index Blocks
            logger.info(f"📚 Sentinel is absorbing blocks from {db_path}...")
            c.execute("SELECT * FROM blocks ORDER BY height DESC LIMIT ?", (limit // 2,))
            blocks = c.fetchall()
            for block in blocks:
                self.kb.add_block_to_kb(dict(block))
            
            # Index Transactions
            logger.info(f"📚 Sentinel is absorbing transactions from {db_path}...")
            c.execute("SELECT * FROM transactions ORDER BY timestamp DESC LIMIT ?", (limit // 2,))
            txs = c.fetchall()
            for tx in txs:
                self.kb.add_transaction_to_kb(dict(tx))

            conn.close()
            logger.info(f"✅ Sentinel successfully absorbed {len(blocks) + len(txs)} chain records.")
            
        except Exception as e:
            logger.error(f"❌ Error during chain data absorption: {e}")

    def audit_node(self, node_data: Dict) -> Dict:
        """
        Performs comprehensive audit of a validator node.
        
        Args:
            node_data: {
                'address': str,
                'claims': List[Dict],
                'reputation': float,
                'liquidity': float,
                'protocols': List[str],
                'volume': float,
                'uptime': float
            }
            
        Returns:
            {
                'status': 'VERIFIED' | 'FLAGGED' | 'BANNED',
                'final_multiplier': float,
                'fraud_score': float,
                'bonus_multiplier': float,
                'recommendations': List[str]
            }
        """
        claim_sequence = node_data.get('claims', [])
        
        # Fraud Detection
        is_bot = self.detector.is_sybil_pattern(claim_sequence)
        fraud_score = 0.9 if is_bot else 0.1
        
        # Bonus Calculation (only for legitimate nodes)
        bonus_multiplier = 1.0
        if not is_bot:
            bonus_multiplier = self.bonus_calc.calculate_defi_bonus(node_data)
        
        # Reputation Adjustment
        base_reputation = node_data.get('reputation', 1.0)
        reputation_score = 0.1 if is_bot else base_reputation
        
        # Final Multiplier
        final_multiplier = reputation_score * bonus_multiplier
        
        # Status Determination
        if fraud_score > 0.8:
            status = "BANNED" if fraud_score > 0.95 else "FLAGGED"
        else:
            status = "VERIFIED"
        
        # Recommendations
        recommendations = self._generate_recommendations(node_data, is_bot, bonus_multiplier)
        
        # Log Audit
        audit_result = {
            "timestamp": int(time.time()),
            "address": node_data.get('address', 'UNKNOWN'),
            "status": status,
            "final_multiplier": round(final_multiplier, 4),
            "fraud_score": round(fraud_score, 4),
            "bonus_multiplier": round(bonus_multiplier, 4),
            "recommendations": recommendations
        }
        
        self.audit_log.append(audit_result)
        
        return audit_result
    
    def _generate_recommendations(self, node_data: Dict, is_fraud: bool, bonus: float) -> List[str]:
        """Generates actionable recommendations for validators."""
        recs = []
        
        if is_fraud:
            recs.append("⚠️ Suspicious activity detected. Reduce claim frequency.")
            recs.append("🔍 Under review for potential Sybil attack.")
        else:
            if bonus < 1.5:
                recs.append("💡 Increase DeFi participation to boost rewards.")
            if node_data.get('uptime', 1.0) < 0.99:
                recs.append("⏱️ Improve uptime to maximize bonuses.")
            if len(node_data.get('protocols', [])) < 3:
                recs.append("🔗 Interact with more protocols for diversity bonus.")
        
        return recs
    
    def get_network_health_report(self) -> Dict:
        """Generates a network-wide health report."""
        if not self.audit_log:
            return {"status": "NO_DATA"}
        
        recent_audits = self.audit_log[-100:]  # Last 100 audits
        
        flagged_count = sum(1 for a in recent_audits if a['status'] in ['FLAGGED', 'BANNED'])
        avg_multiplier = sum(a['final_multiplier'] for a in recent_audits) / len(recent_audits)
        
        return {
            "total_audits": len(recent_audits),
            "flagged_nodes": flagged_count,
            "flagged_percentage": round(flagged_count / len(recent_audits) * 100, 2),
            "avg_multiplier": round(avg_multiplier, 4),
            "network_health": "HEALTHY" if flagged_count < 5 else "AT_RISK"
        }


# Example Usage
if __name__ == "__main__":
    engine = SentinelV3Engine()
    
    # Test Case 1: Legitimate Validator
    legitimate_node = {
        "address": "0xABC123",
        "claims": [
            {"timestamp": 1000, "amount": 100, "gasPrice": 25},
            {"timestamp": 1200, "amount": 100, "gasPrice": 27},
            {"timestamp": 1500, "amount": 100, "gasPrice": 23}
        ],
        "reputation": 1.0,
        "liquidity": 50000,
        "protocols": ["Uniswap", "Aave", "Compound"],
        "volume": 100000,
        "uptime": 0.995
    }
    
    # Test Case 2: Suspicious Bot
    bot_node = {
        "address": "0xBOT999",
        "claims": [
            {"timestamp": 1000, "amount": 100, "gasPrice": 25},
            {"timestamp": 1030, "amount": 100, "gasPrice": 25},  # Too fast
            {"timestamp": 1060, "amount": 100, "gasPrice": 25},  # Same gas
            {"timestamp": 1090, "amount": 100, "gasPrice": 25}
        ],
        "reputation": 0.5,
        "liquidity": 0,
        "protocols": [],
        "volume": 0,
        "uptime": 0.80
    }
    
    print("=== AUDIT RESULTS ===\n")
    
    result1 = engine.audit_node(legitimate_node)
    print(f"Legitimate Node: {result1['status']}")
    print(f"Final Multiplier: {result1['final_multiplier']}")
    print(f"Recommendations: {result1['recommendations']}\n")
    
    result2 = engine.audit_node(bot_node)
    print(f"Bot Node: {result2['status']}")
    print(f"Final Multiplier: {result2['final_multiplier']}")
    print(f"Recommendations: {result2['recommendations']}\n")
    
    health = engine.get_network_health_report()
    print(f"Network Health: {health}")
