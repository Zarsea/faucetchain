# Sobe a FaucetChain local, cada peca na sua janela.
#
# Existe porque os processos iniciados de dentro do assistente morrem por limite
# de tempo, sempre no meio de um teste -- e a falha e silenciosa do lado de quem
# clica: o navegador mostra "nao registrou", nao "o servidor sumiu".
#
#     .\start-local.ps1              sobe API, explorer e tunel
#     .\start-local.ps1 -SemTunel    so API e explorer (uso local)
#     .\start-local.ps1 -ComNo       inclui o no minerador
#
# Cada peca abre numa janela propria. Fechar a janela derruba so aquela peca.

param(
    [switch]$SemTunel,
    [switch]$ComNo
)

$raiz = $PSScriptRoot

function Subir([string]$titulo, [string]$cmd, [string]$dir) {
    Write-Host "  subindo $titulo..." -ForegroundColor DarkGray
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "`$Host.UI.RawUI.WindowTitle = 'FaucetChain - $titulo'; Set-Location '$dir'; $cmd"
    )
}

Write-Host ""
Write-Host "FaucetChain local" -ForegroundColor Cyan
Write-Host ""

# --- A API ---------------------------------------------------------------
# --proxy-headers nao e opcional atras do tunel: sem ele todo visitante chega
# como 127.0.0.1 e divide um unico contador de rate limit, o que transforma o
# limite num amplificador de negacao de servico em vez de uma defesa.
# O Python do venv, nao o do PATH. O do sistema nao tem solders, e sem ele o
# servidor sobe, serve todas as telas, e toda leitura da Solana volta nula --
# em silencio, porque quem chama engole a excecao e devolve "nao consegui ler".
$py = Join-Path $raiz '.venv\Scripts\python.exe'
if (-not (Test-Path $py)) {
    Write-Host "  .venv nao encontrado; usando o python do PATH" -ForegroundColor Yellow
    Write-Host "  se as telas da Solana vierem vazias, e isto" -ForegroundColor Yellow
    $py = 'python'
}

Subir "API" @"
`$env:FORWARDED_ALLOW_IPS = '127.0.0.1'
& '$py' -m uvicorn api_server:app --host 0.0.0.0 --port 8010 --proxy-headers --forwarded-allow-ips 127.0.0.1
"@ $raiz

Subir "Explorer" "npm run dev" $raiz

if (-not $SemTunel) {
    Subir "Tunel" "ngrok http 8010" $raiz
}

if ($ComNo) {
    Subir "No minerador" @"
`$env:API_URL = 'http://127.0.0.1:8010'
`$env:WALLET_ADDRESS = '0xb3dff5d3f802ebba471c2498f223c52b8f7d5ad5'
`$env:NODE_NAME = 'no-demo-1'
node index.js
"@ (Join-Path $raiz 'mining-node')
}

# --- Conferencia ---------------------------------------------------------
Write-Host ""
Write-Host "  esperando a API responder..." -ForegroundColor DarkGray
$pronta = $false
foreach ($i in 1..40) {
    Start-Sleep -Seconds 2
    try {
        Invoke-WebRequest -Uri "http://localhost:8010/api/faucethub/faucets" -TimeoutSec 3 -UseBasicParsing | Out-Null
        $pronta = $true
        break
    } catch { }
}

Write-Host ""
if ($pronta) {
    Write-Host "  API        http://localhost:8010   ok" -ForegroundColor Green
    # Responder nao basta: sem solders a API serve tudo e le nada da Solana.
    try {
        $l = Invoke-RestMethod -Uri "http://localhost:8010/api/solana/ledger/479079" -TimeoutSec 25
        if ($l.on_chain) {
            Write-Host "  Solana     legivel (vault e raizes chegando)" -ForegroundColor Green
        } else {
            Write-Host "  Solana     NAO LEGIVEL -- as telas de liquidacao virao vazias" -ForegroundColor Red
            Write-Host "             quase sempre e o python errado, sem solders" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  Solana     nao consegui conferir" -ForegroundColor Yellow
    }
} else {
    Write-Host "  API        nao respondeu em 80s -- veja a janela 'FaucetChain - API'" -ForegroundColor Red
}
Write-Host "  Explorer   http://localhost:5173" -ForegroundColor Green

if (-not $SemTunel) {
    Write-Host ""
    Write-Host "  O tunel leva um instante a mais. Para conferir:" -ForegroundColor DarkGray
    Write-Host "    curl https://unfrosted-ignition-ruined.ngrok-free.dev/api/faucethub/faucets" -ForegroundColor DarkGray
    Write-Host "    404 = ngrok fora   502 = ngrok de pe, API fora" -ForegroundColor DarkGray
}
Write-Host ""
