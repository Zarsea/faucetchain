def fix_routes():
    with open('api_server.py', 'r', encoding='utf-8') as f:
        content = f.read()

    start_idx = content.find('# --- Frontend Serving (Must be at the bottom) ---')
    end_idx = content.find('# --- EMAIL AUTHENTICATION SYSTEM ---')
    
    if start_idx != -1 and end_idx != -1:
        frontend_and_main_block = content[start_idx:end_idx]
        new_content = content.replace(frontend_and_main_block, '')
        new_content = new_content.strip() + '\n\n' + frontend_and_main_block.strip() + '\n'
        
        with open('api_server.py', 'w', encoding='utf-8') as f:
            f.write(new_content)

if __name__ == '__main__':
    fix_routes()
