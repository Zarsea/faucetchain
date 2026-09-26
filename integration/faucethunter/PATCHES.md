# As edições em arquivos que já existem

Tudo o que dava para fazer em arquivo novo está em arquivo novo. Sobraram
**duas** edições, e uma delas não é da integração — é segurança, e vale
independentemente de a FaucetChain existir.

Aplique à mão. Nada aqui roda sozinho.

---

## 1 — `public/api/claim.php` · a integração · duas linhas

**No topo**, junto dos outros `require_once`:

```php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/faucetchain.php';   // ← acrescente
```

**Logo depois do `$pdo->commit();`**, antes do `echo json_encode([...])`:

```php
    $pdo->commit();

    // A FaucetChain é avisada DEPOIS do commit, e o erro dela morre aqui: o
    // claim do usuário já está gravado quando esta linha roda.
    $fc = null;
    try {
        $fc = faucetchainNotifyClaim($pdo, $userId);
    } catch (Throwable $e) {
        error_log('[FaucetChain] ' . $e->getMessage());
    }
```

E, se quiser mostrar na tela o que a campanha pagou, acrescente uma linha ao
array da resposta:

```php
        'cooldown_remaining' => $cooldownSec,
        'faucetchain' => $fc,          // ← acrescente
```

### Por que o `try` próprio

O bloco inteiro do claim está dentro de um `try/catch` que responde **500**. Sem
o `try` interno, um imprevisto vindo da nossa chamada viraria um 500 sobre um
claim que **já foi gravado e já é do usuário** — ele veria erro, e o saldo teria
subido. O `try` de dentro garante que o pior caso seja uma linha no log.

### Por que depois do `commit()`

Esta é a única coisa deste arquivo que não pode mudar de lugar. O pagamento da
FaucetHunter tem que estar gravado antes de a FaucetChain sequer ser procurada.
Um pagamento não pode depender do tempo de vida de outra pessoa.

### O que *não* precisa mais

Numa versão anterior eu pedia uma terceira edição, em `db.php`, para trazer
`solana_address` no `SELECT` da sessão. **Não precisa.** A ponte agora busca o
endereço sozinha, a partir do `$userId`. Se você já aplicou aquela edição, ela
não atrapalha — só ficou desnecessária.

---

## 2 — `public/api/auth.php` · segurança · não é da integração

> Isto é um **bypass de autenticação**, não uma melhoria. Vale a pena aplicar
> mesmo que a integração com a FaucetChain fique para outro dia.

O `case 'faucetpay_connect'` emitia sessão **sem conferir a senha** quando o
chamador simplesmente não mandava uma. O padrão aparece **duas vezes** no
arquivo: no ramo com MySQL e no ramo de fallback em `platform_data.json`.

**Como está:**

```php
if (!empty($user['password_hash']) && !empty($password)) {
    if (!password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Senha incorreta para esta conta FaucetPay.']);
        exit();
    }
} elseif (empty($user['password_hash']) && !empty($password) && strlen($password) >= 6) {
```

Conta **com** senha + chamada **sem** senha → nenhum dos dois ramos executa →
cai fora do `if` e a sessão é emitida assim mesmo.

**Como fica** (tire o `&& !empty($password)` da primeira condição e trate a
senha ausente como senha errada):

```php
if (!empty($user['password_hash'])) {
    if (empty($password) || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Senha incorreta para esta conta FaucetPay.']);
        exit();
    }
} elseif (empty($user['password_hash']) && !empty($password) && strlen($password) >= 6) {
```

No ramo de fallback a variável se chama `$userFound` em vez de `$user`; o resto
é idêntico.

### Por que isso importa

O `SELECT` aceita **e-mail ou endereço FaucetPay**. Endereço de saque é
semi-público por natureza — as pessoas colam isso em torneira o dia inteiro. E
o `withdraw.php` autentica **só pela sessão**. A cadeia fecha: endereço
conhecido → sessão → saldo do outro sai.

O `case 'login'` do mesmo arquivo faz certo: exige os dois e responde 401. Só o
`faucetpay_connect` não fazia.

### O que ficou de fora, de propósito

Conta **sem** `password_hash` continua conectável só com o endereço. Também é
buraco, mas fechá-lo derruba quem já usa a plataforma e nunca definiu senha.
Rode antes de decidir:

```sql
SELECT COUNT(*) FROM fh_users WHERE password_hash IS NULL OR password_hash = '';
```

Um punhado → exigir senha no connect resolve. A maioria da base → precisa de um
caminho de transição, e aí é decisão de produto, não de código.
