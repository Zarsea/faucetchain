<?php
/**
 * FaucetHunter × FaucetChain — ponte de distribuição
 *
 * Arquivo NOVO. Não substitui nem edita nada do que já existe na FaucetHunter.
 * Copie para `public/api/` (e para `dist/api/` se for publicar sem rodar build).
 *
 * O que faz: quando a FaucetHunter credita um claim, avisa a FaucetChain. O
 * usuário passa a receber, além do que já recebe aí, a parte que lhe cabe do
 * orçamento das campanhas de parceiros — garantida por uma raiz publicada na
 * Solana, e não por uma linha em banco de dados nenhum.
 *
 * O que NÃO faz: nada que possa quebrar o claim da FaucetHunter. A chamada
 * acontece depois do commit, tem timeout curto e engole o próprio erro. Se a
 * FaucetChain estiver fora do ar, o usuário recebe o claim dele normalmente e
 * ninguém fica sabendo. Um pagamento não pode depender do tempo de vida de
 * outra pessoa.
 *
 * Esta versão busca o endereço Solana sozinha, a partir do id do usuário. É de
 * propósito: assim o `db.php` não precisa ser tocado. Um SELECT explícito que
 * não trouxesse a coluna faria a ponte virar um no-op silencioso em todo
 * claim — sem erro, sem log, sem recompensa — e esse é o jeito mais comum de
 * uma integração parecer pronta e não pagar nada.
 */

if (!defined('FAUCETCHAIN_URL')) {
    define('FAUCETCHAIN_URL', getenv('FAUCETCHAIN_URL') ?: '');
}
if (!defined('FAUCETCHAIN_KEY')) {
    define('FAUCETCHAIN_KEY', getenv('FAUCETCHAIN_KEY') ?: '');
}

// Quanto do claim vira trabalho registrado na FaucetChain. NÃO é o valor que o
// usuário ganha da campanha — esse a rede calcula sozinha, a partir do
// orçamento, dos dias restantes e de quanta gente está participando. Este
// número diz apenas "houve um clique". A FaucetChain aceita de 0 a 100.
if (!defined('FAUCETCHAIN_CLAIM_UNITS')) {
    define('FAUCETCHAIN_CLAIM_UNITS', 1.0);
}


/**
 * Avisa a FaucetChain de um claim. Devolve o que as campanhas pagaram, ou null.
 *
 * @param PDO|null $pdo     conexão já aberta (a mesma do claim)
 * @param int|null $userId  id em fh_users. Sem usuário logado não há para quem
 *                          pagar, e a função simplesmente não faz nada.
 */
function faucetchainNotifyClaim(?PDO $pdo, $userId): ?array
{
    if (!FAUCETCHAIN_URL || !FAUCETCHAIN_KEY || !$pdo || !$userId) {
        return null;
    }

    try {
        $stmt = $pdo->prepare("SELECT solana_address FROM fh_users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $userId]);
        $solanaAddress = trim((string)($stmt->fetchColumn() ?: ''));
    } catch (Throwable $e) {
        // A coluna pode não existir ainda (migração não rodou). Isso não é
        // motivo para atrapalhar o claim de ninguém.
        error_log('[FaucetChain] solana_address indisponível: ' . $e->getMessage());
        return null;
    }

    // Quem não informou carteira continua usando a FaucetHunter como sempre.
    if ($solanaAddress === '') {
        return null;
    }

    $ch = curl_init(rtrim(FAUCETCHAIN_URL, '/') . '/api/faucethub/microclaim');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        // Curto de propósito. O usuário está esperando a resposta do claim
        // dele; ele não tem que esperar pela nossa infraestrutura.
        CURLOPT_TIMEOUT        => 4,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Api-Key: ' . FAUCETCHAIN_KEY,
        ],
        CURLOPT_POSTFIELDS => json_encode([
            // A FaucetChain aceita o endereço Solana direto e deriva a conta
            // dela a partir dele (keccak256 da chave pública, últimos 20
            // bytes). O usuário depois entra lá com a mesma carteira e cai
            // exatamente nessa conta, com o prêmio dentro. Nada além de uma
            // chave pública precisa ser compartilhado entre as duas casas.
            'user_wallet' => $solanaAddress,
            'amount'      => FAUCETCHAIN_CLAIM_UNITS,
        ]),
    ]);

    $raw    = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        // Fora do ar. O claim do usuário já foi creditado antes desta chamada.
        error_log('[FaucetChain] inalcançável — claim seguiu normalmente');
        return null;
    }

    // 429 é o cooldown de 5 minutos da FaucetChain, idêntico ao desta casa.
    // Não é erro: é a mesma trava, do outro lado. Logar isso encheria o log de
    // alarme falso.
    if ($status === 429) {
        return null;
    }

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        error_log('[FaucetChain] resposta ininteligível (HTTP ' . $status . ')');
        return null;
    }
    if ($status >= 400) {
        error_log('[FaucetChain] recusou: ' . ($body['detail'] ?? 'sem motivo'));
        return null;
    }

    return [
        // Onde o prêmio caiu — a conta FaucetChain derivada da carteira.
        'address'   => $body['user_address'] ?? null,
        // O que cada campanha pagou neste clique, se alguma pagou. Lista vazia
        // NÃO é erro: significa que esta torneira não está inscrita em nenhuma
        // campanha, ou que todas estão sem orçamento no mês.
        'campaigns' => $body['campaigns'] ?? [],
    ];
}
