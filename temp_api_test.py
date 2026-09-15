import requests
import json

try:
    url = "http://127.0.0.1:8000/api/mining/register"
    payload = {
        "wallet_address": "0xA1B2C3D4E5F6789012345678ABCDEF0123456789",
        "node_id": "fcn-123456781234",
        "node_name": "test-node",
        "version": "1.0.0"
    }
    r = requests.post(url, json=payload)
    print("STATUS:", r.status_code)
    print("RESPONSE:", r.text)

    # test duplicate
    r2 = requests.post(url, json=payload)
    print("STATUS 2:", r2.status_code)
    print("RESPONSE 2:", r2.text)

except Exception as e:
    print("Error:", e)
