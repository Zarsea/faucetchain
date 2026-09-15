// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title UTXOStakingVault
 * @notice Cada depósito de CLAIM gera um NFT ERC-721 que representa um "UTXO de staking".
 *         O NFT carrega metadados de valor, timestamp, timelock e taxa de yield.
 *         Para retirar fundos, o usuário "gasta" (queima) o NFT correspondente.
 *
 *         Lock Tiers (conferem com o construtor abaixo):
 *           Tier 0 → 1 hora,   0.5% yield  (50 bp)
 *           Tier 1 → 24 horas, 2%   yield  (200 bp)
 *           Tier 2 → 7 dias,   10%  yield  (1000 bp)
 */
contract UTXOStakingVault is ERC721Enumerable {

    // ─── Types ────────────────────────────────────────────────────────
    struct StakeUTXO {
        uint256 depositAmount;      // CLAIM travado
        uint256 depositTimestamp;   // quando foi depositado
        uint256 lockDuration;       // duração do lock em segundos
        uint256 yieldBasisPoints;   // yield em basis points (50 = 0.5%)
        bool    isSpent;            // flag de UTXO gasto
    }

    // ─── State ────────────────────────────────────────────────────────
    IERC20  public claimToken;
    address public governanceOwner;

    uint256 private _nextTokenId;

    /// tokenId → metadados do UTXO
    mapping(uint256 => StakeUTXO) public utxos;

    /// Tier → lockDuration (seconds)
    mapping(uint256 => uint256) public tierDuration;

    /// Tier → yieldBasisPoints
    mapping(uint256 => uint256) public tierYield;

    uint256 public totalStaked;
    uint256 public totalYieldPaid;

    // ─── Events ───────────────────────────────────────────────────────
    event UTXOCreated(
        address indexed staker,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 tier,
        uint256 lockUntil
    );
    event UTXOSpent(
        address indexed staker,
        uint256 indexed tokenId,
        uint256 principal,
        uint256 yieldPaid
    );

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _claimToken) ERC721("FaucetChain Staking UTXO", "fcUTXO") {
        claimToken = IERC20(_claimToken);
        governanceOwner = msg.sender;

        // Tier 0: 1 hora  → 0.5%
        tierDuration[0] = 1 hours;
        tierYield[0]    = 50;       // 50 bp = 0.50%

        // Tier 1: 24 horas → 2%
        tierDuration[1] = 24 hours;
        tierYield[1]    = 200;      // 200 bp = 2.00%

        // Tier 2: 7 dias → 10%
        tierDuration[2] = 7 days;
        tierYield[2]    = 1000;     // 1000 bp = 10.00%
    }

    // ─── Modifiers ────────────────────────────────────────────────────
    modifier onlyGovernance() {
        require(msg.sender == governanceOwner, "Restrito a governanca");
        _;
    }

    // ─── Core: Stake (criar UTXO) ────────────────────────────────────
    /**
     * @notice Deposita CLAIM e recebe um NFT representando o UTXO de staking.
     * @param amount  Quantidade de CLAIM (18 decimais)
     * @param tier    0 = 1h, 1 = 24h, 2 = 7d
     */
    function stake(uint256 amount, uint256 tier) external returns (uint256 tokenId) {
        require(amount > 0, "Deposito deve ser > 0");
        require(tierDuration[tier] > 0, "Tier invalido");

        // Transferir CLAIM do usuário para o vault
        require(
            claimToken.transferFrom(msg.sender, address(this), amount),
            "Falha na transferencia de CLAIM"
        );

        tokenId = _nextTokenId++;
        _safeMint(msg.sender, tokenId);

        utxos[tokenId] = StakeUTXO({
            depositAmount:    amount,
            depositTimestamp: block.timestamp,
            lockDuration:     tierDuration[tier],
            yieldBasisPoints: tierYield[tier],
            isSpent:          false
        });

        totalStaked += amount;

        emit UTXOCreated(
            msg.sender,
            tokenId,
            amount,
            tier,
            block.timestamp + tierDuration[tier]
        );
    }

    // ─── Core: Unstake (gastar UTXO) ─────────────────────────────────
    /**
     * @notice Queima o NFT, devolve o principal + yield acumulado.
     *         Só pode ser chamado pelo dono e após o timelock expirar.
     */
    function unstake(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Nao e o dono deste UTXO");

        StakeUTXO storage u = utxos[tokenId];
        require(!u.isSpent, "UTXO ja foi gasto");
        require(
            block.timestamp >= u.depositTimestamp + u.lockDuration,
            "Timelock ativo: aguarde o vencimento"
        );

        // Calcular yield
        uint256 yieldAmount = (u.depositAmount * u.yieldBasisPoints) / 10_000;
        uint256 payout = u.depositAmount + yieldAmount;

        // Marcar como gasto
        u.isSpent = true;
        totalStaked -= u.depositAmount;
        totalYieldPaid += yieldAmount;

        // Queimar NFT (destruir UTXO)
        _burn(tokenId);

        // Pagar o principal + yield
        // NOTA: Em produção, o yield viria de um pool de recompensas separado.
        // Para o PoC, o vault precisa ter saldo suficiente (depositado pela governança).
        require(
            claimToken.transfer(msg.sender, payout),
            "Falha no pagamento"
        );

        emit UTXOSpent(msg.sender, tokenId, u.depositAmount, yieldAmount);
    }

    // ─── Views ────────────────────────────────────────────────────────

    /**
     * @notice Retorna detalhes completos de um UTXO de staking.
     */
    function getPositionDetails(uint256 tokenId) external view returns (
        uint256 depositAmount,
        uint256 depositTimestamp,
        uint256 lockDuration,
        uint256 yieldBasisPoints,
        uint256 unlockTime,
        uint256 estimatedYield,
        bool    isSpent,
        bool    isUnlocked
    ) {
        StakeUTXO memory u = utxos[tokenId];
        unlockTime     = u.depositTimestamp + u.lockDuration;
        estimatedYield = (u.depositAmount * u.yieldBasisPoints) / 10_000;
        isUnlocked     = block.timestamp >= unlockTime;

        return (
            u.depositAmount,
            u.depositTimestamp,
            u.lockDuration,
            u.yieldBasisPoints,
            unlockTime,
            estimatedYield,
            u.isSpent,
            isUnlocked
        );
    }

    /**
     * @notice Lista todos os token IDs ativos (não gastos) de um usuário.
     */
    function getActivePositions(address user) external view returns (uint256[] memory) {
        uint256 bal = balanceOf(user);
        uint256[] memory ids = new uint256[](bal);
        for (uint256 i = 0; i < bal; i++) {
            ids[i] = tokenOfOwnerByIndex(user, i);
        }
        return ids;
    }

    // ─── Governance ───────────────────────────────────────────────────

    /**
     * @notice Permite à governança depositar CLAIM no vault para cobrir yields.
     */
    function fundYieldPool(uint256 amount) external onlyGovernance {
        require(
            claimToken.transferFrom(msg.sender, address(this), amount),
            "Falha no funding"
        );
    }

    /**
     * @notice Atualiza tier existente ou cria novo.
     */
    function setTier(uint256 tier, uint256 duration, uint256 yieldBp) external onlyGovernance {
        tierDuration[tier] = duration;
        tierYield[tier]    = yieldBp;
    }
}
