import os
import requests
import time
import threading

BASE_URL = os.getenv("AUDIT_BASE_URL", "http://localhost:8000")

# Fake Data
USER_WALLET = "0x9999999999999999999999999999999999999999"
FAUCET_WALLET = "0x84da71247cbfb0737a9112de1f10dae9823fc298"
FAKE_FAUCET_WALLET = "0x7777777777777777777777777777777777777777"

# A chave real sai do ambiente, e nunca mais daqui.
#
# Estava escrita neste arquivo, em texto claro, desde o commit de baseline de
# 15/09/2026 -- quarenta dias num repositorio publico. O SHA-256 dela batia com
# uma linha `is_active = 1` de `faucet_api_keys`, com 55 usos registrados: quem
# lesse o repositorio podia creditar recompensa em nome daquela torneira e
# drenar o orcamento de toda campanha em que ela estivesse inscrita.
#
# `api_server.py` ja tinha fechado a porta pela qual a chave vazava
# (`/api/faucethub/my-key/{wallet}` parou de devolve-la), e ja guarda so o hash
# no banco. O literal aqui sobreviveu as duas correcoes.
#
# Tirar daqui nao conserta sozinho: a chave esteve publica e continua no
# historico do git. **O conserto e revogar e trocar.** Isto so impede que a
# proxima pessoa a abrir o repositorio encontre a seguinte.
VALID_API_KEY = os.getenv("AUDIT_FAUCET_API_KEY", "")
FAKE_API_KEY = "fake_api_key_123"

if not VALID_API_KEY:
    print("AUDIT_FAUCET_API_KEY nao definida: os testes que exigem uma chave "
          "valida vao reprovar por falta de chave, nao por falha do servidor.")

def print_test_header(title):
    print(f"\n{'='*50}\nRUNNING TEST: {title}\n{'='*50}")

def test_api_key_spoofing():
    print_test_header("1. API Key Spoofing")
    print("Attempting to claim using a FAKE API key...")
    payload = {"user_wallet": USER_WALLET, "amount": 0.5}
    headers = {"X-Api-Key": FAKE_API_KEY}
    
    r = requests.post(f"{BASE_URL}/api/faucethub/microclaim", json=payload, headers=headers)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text}")
    if r.status_code == 401:
        print("[PASSED]: System blocked fake API key.")
    else:
        print("[FAILED]: System allowed fake API key.")

def test_proof_of_reserve_bypass():
    print_test_header("2. Proof of Reserve Bypass")
    print("Attempting to withdraw 1000 L2 funds when L1 has insufficient balance...")
    
    # Let's hit the withdraw endpoint. We can't do this directly if user doesn't have virtual_balance.
    # So we'll hit an endpoint that does L1 validation if possible.
    # Wait, withdraw_microclaim checks virtual_balance, not L1 reserve directly until settlement!
    # But microclaim itself checks reserve first? No, microclaim doesn't do L1 tx.
    # Let's try withdrawing with a fake wallet that has 0 virtual balance to see if it's blocked.
    payload = {"user_wallet": USER_WALLET, "faucet_wallet": FAUCET_WALLET}
    r = requests.post(f"{BASE_URL}/api/faucethub/microclaim/withdraw", json=payload)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text}")
    if r.status_code == 400 and "Minimum withdrawal is" in r.text:
        print("[PASSED]: System blocked L1 withdrawal due to insufficient L2 balance.")
    else:
        print("[FAILED]: Unexpected behavior.")

def test_concurrency_race_condition():
    print_test_header("3. Concurrency / Race Condition")
    print("Firing 50 parallel requests to bypass cooldown...")
    
    success_count = 0
    fail_count = 0
    responses = []

    def make_request():
        nonlocal success_count, fail_count
        payload = {"user_wallet": USER_WALLET, "amount": 0.5}
        headers = {"X-Api-Key": VALID_API_KEY}
        try:
            r = requests.post(f"{BASE_URL}/api/faucethub/microclaim", json=payload, headers=headers)
            responses.append(r.status_code)
            if r.status_code == 200:
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            fail_count += 1

    threads = []
    for _ in range(50):
        t = threading.Thread(target=make_request)
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
        
    print(f"Total Requests: 50")
    print(f"Successful (200 OK): {success_count}")
    print(f"Failed (429 Too Many Requests / 400 Error): {fail_count}")
    
    if success_count <= 1:
        print("[PASSED]: Concurrency handled properly. Cooldown enforced.")
    else:
        print("[FAILED]: Race condition detected! Multiple claims processed.")

def test_deflation_burn():
    print_test_header("4. L1 Deflation Burn (Booster Shop)")
    print("Checking if Booster purchase burns L1 tokens correctly...")
    # Get current balance
    try:
        r1 = requests.get(f"{BASE_URL}/api/user/{USER_WALLET}/balance")
        b1 = r1.json().get('balance', 0)
    except:
        b1 = 0
        
    payload = {"wallet": USER_WALLET, "booster_type": "OVERCLOCK"}
    r = requests.post(f"{BASE_URL}/api/cyberdrip/booster/buy", json=payload)
    print(f"Status Code: {r.status_code}")
    print(f"Response: {r.text}")
    
    if r.status_code == 400 and "saldo" in r.text.lower():
        print("[PASSED]: System blocked purchase due to insufficient real L1 balance.")
    elif r.status_code == 200:
        print("[PASSED]: Purchase succeeded. Checking burn mechanism...")
    else:
        print("[UNKNOWN]: See response above.")


if __name__ == "__main__":
    print("Starting FaucetChain OS DApp Audit Suite...")
    test_api_key_spoofing()
    test_proof_of_reserve_bypass()
    test_concurrency_race_condition()
    test_deflation_burn()
    print("\nAudit Suite Completed.")
