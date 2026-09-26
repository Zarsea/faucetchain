<?php
/**
 * FaucetHunter × FaucetChain — onde o usuário informa a carteira Solana
 *
 * Arquivo NOVO. Copie para `public/api/`. Não edita nada que já existe.
 *
 *   GET-equivalente:  {"action":"get"}    devolve o endereço salvo
 *   POST:             {"action":"save","solana_address":"..."}
 *   Remover:          {"action":"save","solana_address":""}
 *
 * Exige X-Session-Token, como claim.php, withdraw.php e balance.php. Sem
 * sessão não há conta para gravar, e gravar a carteira de recebimento de
 * outra pessoa é exatamente o que não pode acontecer aqui.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

sendCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Método não permitido. Use POST.']);
    exit();
}

$data  = json_decode(file_get_contents('php://input'), true) ?: [];
$token = $_SERVER['HTTP_X_SESSION_TOKEN'] ?? ($data['session_token'] ?? '');

$pdo = getDatabaseConnection();
if (!$pdo) {
    http_response_code(503);
    echo json_encode(['success' => false, 'error' => 'Banco indisponível. Tente em instantes.']);
    exit();
}

$user = getAuthenticatedUser($pdo, $token);
if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Faça login para definir sua carteira Solana.']);
    exit();
}

$action = $data['action'] ?? 'get';


/**
 * Base58 é o alfabeto do Bitcoin: sem 0, O, I e l, justamente porque se
 * confundem à leitura. Um endereço Solana é uma chave pública de 32 bytes,
 * que nesse alfabeto dá 32 a 44 caracteres.
 *
 * Isto é checagem de FORMA. Que a chave exista e seja utilizável, quem diz é
 * a FaucetChain, logo abaixo.
 */
function fcLooksLikeSolanaAddress(string $addr): bool
{
    $len = strlen($addr);
    return $len >= 32 && $len <= 44
        && preg_match('/^[1-9A-HJ-NP-Za-km-z]+$/', $addr) === 1;
}

/**
 * Pergunta à FaucetChain qual conta esta carteira alcança.
 *
 * Serve para duas coisas: confirmar que a chave é válida de verdade, e poder
 * mostrar ao usuário o endereço onde o prêmio dele vai cair — antes de ele
 * clicar em nada.
 *
 * Devolve null quando a FaucetChain não responde. Nesse caso o endereço é
 * salvo assim mesmo: derrubar o cadastro porque a outra casa está fora do ar
 * seria o mesmo erro que a ponte foi escrita para não cometer.
 */
function fcResolveAccount(string $addr): ?string
{
    if (!defined('FAUCETCHAIN_URL') || !FAUCETCHAIN_URL) {
        return null;
    }
    $ch = curl_init(rtrim(FAUCETCHAIN_URL, '/') . '/api/auth/solana/' . rawurlencode($addr));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_CONNECTTIMEOUT => 2,
    ]);
    $raw    = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $status >= 400) {
        return null;
    }
    $body = json_decode($raw, true);
    return is_array($body) ? ($body['account'] ?? null) : null;
}


try {
    if ($action === 'get') {
        $stmt = $pdo->prepare("SELECT solana_address FROM fh_users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $user['id']]);
        $addr = trim((string)($stmt->fetchColumn() ?: ''));

        echo json_encode([
            'success'        => true,
            'solana_address' => $addr !== '' ? $addr : null,
            'faucetchain_account' => $addr !== '' ? fcResolveAccount($addr) : null,
        ]);
        exit();
    }

    if ($action !== 'save') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Ação desconhecida.']);
        exit();
    }

    $addr = trim((string)($data['solana_address'] ?? ''));

    // Remover é uma operação legítima: quem informou por engano tem que poder
    // desfazer. Com a coluna vazia a ponte volta a não fazer nada.
    if ($addr === '') {
        $stmt = $pdo->prepare("UPDATE fh_users SET solana_address = NULL WHERE id = :id");
        $stmt->execute([':id' => $user['id']]);
        echo json_encode([
            'success' => true,
            'solana_address' => null,
            'message' => 'Carteira removida. Você continua usando a FaucetHunter normalmente.',
        ]);
        exit();
    }

    if (!fcLooksLikeSolanaAddress($addr)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'Isso não parece um endereço Solana. Copie o endereço da sua carteira (Phantom, Solflare) — tem entre 32 e 44 caracteres.',
        ]);
        exit();
    }

    $account = fcResolveAccount($addr);

    $stmt = $pdo->prepare("UPDATE fh_users SET solana_address = :addr WHERE id = :id");
    $stmt->execute([':addr' => $addr, ':id' => $user['id']]);

    echo json_encode([
        'success'             => true,
        'solana_address'      => $addr,
        'faucetchain_account' => $account,
        'message' => $account
            ? 'Carteira salva. Suas recompensas de campanha vão para essa conta na FaucetChain.'
            : 'Carteira salva. Não conseguimos falar com a FaucetChain agora para confirmar a conta — isso não impede nada.',
    ]);
} catch (Throwable $e) {
    // A causa mais provável é a coluna não existir: a migração em
    // sql/001_add_solana_address.sql ainda não rodou.
    error_log('[FaucetChain] solana_address: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Não foi possível salvar agora.']);
}
