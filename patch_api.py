import re

def patch_api():
    with open('api_server.py', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace .lower() with .strip().lower() for address-like variables
    # We will just replace all `.lower()` that are attached to address variables.
    
    # Let's replace common patterns:
    # address.lower() -> address.strip().lower()
    content = content.replace("address.lower()", "address.strip().lower()")
    content = content.replace("req.user_address.lower()", "req.user_address.strip().lower()")
    content = content.replace("req.miner_address.lower()", "req.miner_address.strip().lower()")
    content = content.replace("req.staker_address.lower()", "req.staker_address.strip().lower()")
    content = content.replace("req.creator_address.lower()", "req.creator_address.strip().lower()")
    content = content.replace("req.hunter_address.lower()", "req.hunter_address.strip().lower()")
    content = content.replace("req.wallet_address.lower()", "req.wallet_address.strip().lower()")
    
    # Fix instances where we might have created .strip().strip().lower()
    content = content.replace(".strip().strip().lower()", ".strip().lower()")
    content = content.replace(".strip().lower().strip()", ".strip().lower()")
    
    with open('api_server.py', 'w', encoding='utf-8') as f:
        f.write(content)
        
    print("Patched api_server.py successfully.")

if __name__ == '__main__':
    patch_api()
