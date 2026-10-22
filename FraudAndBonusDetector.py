"""
FaucetChain Sentinel V3 - Fraud Detection & Bonus Calculation Engine
=====================================================================
Machine Learning module for detecting Sybil attacks and calculating validator bonuses.
"""

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
        # Sem limiar de similaridade: ele media a uniformidade da nossa
        # propria emissao, nao o comportamento de quem clica.
        self.min_claim_interval = 60  # Minimum seconds between legitimate claims
        
    def has_impossible_cadence(self, claim_sequence: List[Dict]) -> bool:
        """Did these claims arrive closer together than the cooldown allows?

        That is the only thing one address's own history can say. It is worth
        saying: the route refuses a claim less than an hour after the last one,
        so a pair closer than a minute is evidence the cooldown was bypassed.

        WHAT THIS NO LONGER DOES, AND WHY
        ---------------------------------
        It used to compress a fingerprint of amount and gas price and call a
        repetitive result a Sybil. Both are constants of this system, not
        choices of the user:

          - every merit claim pays `current_claim_reward()`, which is the same
            number for everybody in the same emission window;
          - the route fills gasPrice with 0 before the sequence ever gets here.

        The fingerprint also rounded the amount to the nearest ten, so 5.59 and
        6.81 both became "10". Every honest sequence collapsed to
        "10_0|10_0|10_0|..." and compressed perfectly, and the detector read
        our own uniform emission as a signature of fraud.

        Measured on 21/10/2026: a wallet claiming legitimately, one hour apart
        every time, crossed the 0.75 threshold at twenty claims -- which is
        exactly how many the route reads. No loyal user got past twenty. The
        first to hit it was the operator's own account, because it had the most
        history.

        The name changed with the behaviour. This sees one address's claims and
        nothing else, so it could never detect a Sybil, which is by definition
        several addresses behaving as one. Calling it that made it sound like a
        guard the network does not have.
        """
        if len(claim_sequence) < 3:
            return False

        # Ordenados crescentes: os intervalos tem de ser positivos.
        timestamps = sorted([claim.get('timestamp', 0) for claim in claim_sequence])
        intervals = [timestamps[i + 1] - timestamps[i] for i in range(len(timestamps) - 1)]
        return bool(intervals) and min(intervals) < self.min_claim_interval

    # O nome antigo continua funcionando para quem ainda chama, e diz o que
    # mudou. Remover de uma vez quebraria chamador fora deste repositorio.
    def is_sybil_pattern(self, claim_sequence: List[Dict]) -> bool:
        """Obsoleto: ver `has_impossible_cadence`. Nunca detectou Sybil."""
        return self.has_impossible_cadence(claim_sequence)



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
        is_bot = self.detector.has_impossible_cadence(claim_sequence)
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
