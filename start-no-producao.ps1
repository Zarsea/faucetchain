# Sobe o no minerador contra a producao, numa janela propria.
#
#     .\start-no-producao.ps1
#     .\start-no-producao.ps1 -Nome "meu-no-02"
#
# Existe por duas razoes.
#
# A primeira e a mesma do start-local.ps1: processo iniciado de dentro do
# assistente morre quando a sessao termina, e a falha e silenciosa -- o painel
# mostra o no offline sem dizer que ninguem o derrubou. Start-Process destaca a
# janela, e so fechar a janela derruba o no.
#
# A segunda e separar identidade. O no guarda um id e um token em arquivo, e sao
# eles que dizem a rede "sou o mesmo de antes". Se o no de producao e o local
# dividissem esses arquivos, cada um sobrescreveria o do outro e a rede veria um
# no trocando de endereco sozinho. Por isso aqui os arquivos terminam em .prod, e
# o .env continua intocado para o uso local.

param(
    [string]$Carteira = "0xb3dff5d3f802ebba471c2498f223c52b8f7d5ad5",
    [string]$Nome     = "zarsea-node-01",
    [string]$Api      = "https://www.faucetchain.com.br"
)

$pasta = Join-Path $PSScriptRoot 'mining-node'
if (-not (Test-Path (Join-Path $pasta 'index.js'))) {
    Write-Host "mining-node/index.js nao encontrado em $pasta" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $pasta 'node_modules'))) {
    Write-Host "Falta instalar as dependencias. Rode primeiro:" -ForegroundColor Yellow
    Write-Host "    cd mining-node; npm install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "No minerador -> $Api" -ForegroundColor Cyan
Write-Host "  carteira : $Carteira"
Write-Host "  nome     : $Nome"
Write-Host "  identidade: .node_id.prod / .node_token.prod (separada da local)"
Write-Host ""

# As variaveis sao setadas DENTRO da janela nova: dotenv nao sobrescreve o que ja
# existe no ambiente, entao elas vencem o .env sem precisar edita-lo.
$cmd = @"
`$Host.UI.RawUI.WindowTitle = 'FaucetChain - no minerador (producao)'
Set-Location '$pasta'
`$env:API_URL         = '$Api'
`$env:WALLET_ADDRESS  = '$Carteira'
`$env:NODE_NAME       = '$Nome'
`$env:NODE_ID_FILE    = '.node_id.prod'
`$env:NODE_TOKEN_FILE = '.node_token.prod'
Write-Host 'Fechar esta janela derruba o no.' -ForegroundColor DarkGray
node index.js
"@

Start-Process powershell -ArgumentList @('-NoExit', '-Command', $cmd)

Write-Host "Janela aberta. Confira em:" -ForegroundColor Green
Write-Host "  $Api/api/mining/node/$Carteira"
Write-Host ""
