# Claim separado por campanha

Para quem mantém o PHP da FaucetHunter, ou qualquer torneira que queira dar um
botão por moeda em vez de um clique só.

A rota é a mesma de sempre — `POST /api/faucethub/microclaim`, com
`X-Api-Key`. O que muda é o corpo.

---

## As três portas

| corpo | paga $CLAIM | paga campanha |
|---|---|---|
| `{"user_wallet": "...", "amount": 1.0}` | sim | **todas** |
| `{"user_wallet": "...", "amount": 1.0, "campaigns": false}` | sim | nenhuma |
| `{"user_wallet": "...", "amount": 0, "campaign_id": 652608}` | **não** | só a 652608 |

A primeira é o que o `api/faucetchain.php` deste repositório faz hoje, e é o
que toda torneira já integrada espera. Ela continua funcionando sem mudança
nenhuma: campos ausentes não mudam comportamento.

## Duas coisas que surpreendem

### O claim por campanha não paga $CLAIM

É de propósito, e está no retorno:

```json
{ "credited": 0.0, "campaigns": [...], "virtual_balance": 12.34 }
```

Uma torneira que trocar o clique único por um clique por moeda **para de pagar
$CLAIM** se não acrescentar uma chamada separada. O desenho completo são duas
coisas:

- um botão de $CLAIM, com `"campaigns": false`
- um botão por campanha, com `"campaign_id"`

### O valor não é a torneira que decide

No claim por campanha o campo `amount` **não é usado**. Quem calcula é o
`_campaign_quote` da FaucetChain, a partir do orçamento restante, dos dias que
faltam e da participação medida naquela campanha.

Uma torneira que anunciar "1 token por clique" na tela dela vai divergir do que
a rede credita. O `amount` só vale para o $CLAIM.

## De onde tirar o que mostrar no botão

`GET /api/faucethub/my-campaigns`, com a mesma `X-Api-Key`. Devolve, por
campanha inscrita:

```json
{
  "campaign_id": 652608,
  "symbol": "FHR",
  "decimals": 6,
  "name": "FaucetHunter Rewards",
  "per_click_estimate": 925900,
  "cooldown_seconds": 300,
  "funding": "vault",
  "status": "active"
}
```

`per_click_estimate` vem da **mesma função que credita de verdade**, com
`write=False`. É de propósito: estimativa feita por uma conta e crédito feito
por outra divergem com o tempo, e quem lê a divergência é o usuário do
parceiro.

`status` traz `"active"` ou o mesmo motivo que o claim devolveria em
`campaigns_skipped`. **São seis motivos, não quatro** — `rate_rounds_to_zero`
e `user_share_rounds_to_zero` também param o pagamento, e chamar isso de
"active" seria prometer um clique que não paga.

Montar a tela a partir daqui é o que evita prometer um token ao usuário e
descobrir no claim que a campanha secou.

## O cooldown

É por `(campanha, torneira, usuário)`, e o padrão são 300 segundos. O relógio é
carimbado nas duas portas, então alternar entre elas não reinicia a contagem de
cada campanha.

**Um furo conhecido e aceito:** o carimbo acontece sem conferir, então uma
torneira que alterne as duas portas pode receber duas vezes na mesma janela. A
razão está no comentário do `_campaign_drip`: conferir ali também quebraria o
claim comum de toda torneira existente na virada do cooldown, em silêncio.

Uma torneira que use **só** o modo separado não encosta nisso. Misturar os dois
é que abre.

## O que o claim por campanha recusa

| HTTP | quando |
|---|---|
| 401 | chave ausente, inválida ou inativa |
| 400 | a torneira não está inscrita naquela campanha, ou a carteira do usuário é inválida |
| 429 | cooldown ativo para aquela campanha, com os segundos no texto |

Os dois casos de 400 chegam com mensagens diferentes em `detail`, e vale
distingui-los no log: *não inscrita* é configuração e se resolve do lado da
FaucetChain; *carteira inválida* é dado do usuário.

O 429 **não é falha**: é o cooldown de cinco minutos por usuário por campanha.
Trate como "nada a fazer".

## O que não muda

Tudo o que o `api/faucetchain.php` deste repositório já promete continua
valendo, e vale repetir porque é o que torna a integração segura de adotar:

- **Quem não informou carteira Solana não é afetado.** A função devolve `null`
  antes de qualquer chamada de rede.
- **O erro é engolido.** Timeout de quatro segundos, conexão de dois, e o corpo
  inteiro dentro de `try`. Se a FaucetChain estiver fora, o usuário da torneira
  recebe o claim dele e ninguém fica sabendo.
- **Nada além de uma chave pública atravessa.** A FaucetChain deriva a conta
  dela do endereço Solana — keccak256 da chave pública, últimos 20 bytes — e o
  usuário depois entra lá com a mesma carteira e cai exatamente nessa conta.

## Exemplo

```php
// 1. O que esta torneira carrega, para montar a tela antes de cobrar.
$campanhas = faucetchainGet('/api/faucethub/my-campaigns');

// 2. O botão do $CLAIM.
faucetchainPost('/api/faucethub/microclaim', [
    'user_wallet' => $solanaAddress,
    'amount'      => FAUCETCHAIN_CLAIM_UNITS,
    'campaigns'   => false,
]);

// 3. Um botão por campanha. O valor mostrado sai de per_click_estimate,
//    nunca de um número fixo escrito aqui.
foreach ($campanhas as $c) {
    if ($c['status'] !== 'active') continue;
    faucetchainPost('/api/faucethub/microclaim', [
        'user_wallet' => $solanaAddress,
        'amount'      => 0,
        'campaign_id' => $c['campaign_id'],
    ]);
}
```

Chamar as campanhas num laço como acima paga todas de uma vez, o que é o
comportamento da porta antiga com mais passos. **O ponto do modo separado é o
contrário:** cada campanha tem o seu botão, o seu cooldown e o seu valor na
tela, e o usuário escolhe qual reivindicar.

---

*Escrito em 27/10/2026, a partir do código em `api_server.py`:
`MicroClaimRequest`, `_claim_one_campaign`, `_campaign_drip` e
`/api/faucethub/my-campaigns`.*
