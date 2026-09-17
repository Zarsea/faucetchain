import os

files_to_update = [
    "components/UserDashboard.tsx",
    "components/Simulation.tsx",
    "components/Overview.tsx",
    "components/KnowledgeBase.ts",
    "components/Header.tsx",
    "components/GeneralArticle.tsx",
    "components/Faucet.tsx",
    "components/ApiDocs.tsx",
    "components/AIChatAgent.tsx",
    "components/WalletExplorer.tsx",
    "FraudAndBonusDetector.py",
    "train_sentinel.py",
    "VectorKnowledgeBase.py"
]

root_dir = r"c:\Users\Administrator\Downloads\copy-of-copy-of-test-net-hybrid-poc+pos-consensus-explorer"

replacements = [
    ("HVM-V2", "PoC-V3"),
    ("HVM_V2", "POC_V3"),
    ("V2.4", "V3.0"),
    ("SentinelV2Engine", "SentinelV3Engine"),
    ("1,000,000,000", "99,000,000"),
    ("1 Bilhão", "99 Milhões"),
    ("1 billion", "99 million"),
    ("Hybrid Voting Machine", "Proof of Claim (PoC)"),
    ("HVM", "PoC"),
    ("V2", "V3"),
]

for filepath in files_to_update:
    full_path = os.path.join(root_dir, filepath)
    if os.path.exists(full_path):
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        for old, new in replacements:
            new_content = new_content.replace(old, new)
            
        if new_content != content:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
        else:
            print(f"No changes for {filepath}")
    else:
        print(f"File not found: {filepath}")
