with open('api_server.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    if '/api/blocks' in line:
        print('Line:', i)
        print(''.join(lines[i:i+30]))
