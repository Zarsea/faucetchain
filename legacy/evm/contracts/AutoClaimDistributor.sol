// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FaucetToken_CLAIM.sol";
import "./HourlyEpochManager.sol";

/**
 * @title AutoClaimDistributor
 * @notice Distribuição automática de $CLAIM para mineradores ativos na rede.
 *         Mineradores rodam um Node Client que envia heartbeats periódicos.
 *         A cada epoch (1 hora), a quota é distribuída proporcionalmente ao uptime de cada nó.
 *
 *         Fluxo:
 *           1. Minerador registra wallet → on-chain
 *           2. Node Client envia heartbeats → off-chain (API server)
 *           3. Epoch termina → Operador chama distributeEpochRewards() com lista de uptime
 *           4. Contrato minta CLAIM para cada minerador → proporcional ao uptime
 */
contract AutoClaimDistributor {

    // ─── State ────────────────────────────────────────────────────────
    FaucetToken_CLAIM public claimToken;
    address public operator;

    struct MinerInfo {
        bool isRegistered;
        uint256 totalEarned;
        uint256 epochsActive;
        uint64  registeredAt;
        uint64  lastRewardEpoch;
    }

    mapping(address => MinerInfo) public miners;
    address[] public minerList;
    uint256 public totalMinersRegistered;
    uint256 public totalDistributed;
    uint256 public currentDistributionEpoch;

    // Quota máxima por epoch (alinhada com HourlyEpochManager)
    uint256 public constant MAX_EPOCH_DISTRIBUTION = 2_000 * 10**18;

    // ─── Events ───────────────────────────────────────────────────────
    event MinerRegistered(address indexed miner, uint64 timestamp);
    event EpochDistributed(
        uint256 indexed epochId,
        uint256 totalMiners,
        uint256 totalAmount
    );
    event RewardPaid(
        address indexed miner,
        uint256 indexed epochId,
        uint256 amount,
        uint256 uptimeShare
    );

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _claimToken) {
        claimToken = FaucetToken_CLAIM(_claimToken);
        operator = msg.sender;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Apenas o operador pode executar");
        _;
    }

    // ─── Registration ─────────────────────────────────────────────────
    /**
     * @notice Minerador registra sua wallet para receber recompensas automáticas.
     */
    function registerMiner() external {
        require(!miners[msg.sender].isRegistered, "Minerador ja registrado");

        miners[msg.sender] = MinerInfo({
            isRegistered: true,
            totalEarned: 0,
            epochsActive: 0,
            registeredAt: uint64(block.timestamp),
            lastRewardEpoch: 0
        });

        minerList.push(msg.sender);
        totalMinersRegistered++;

        emit MinerRegistered(msg.sender, uint64(block.timestamp));
    }

    // ─── Epoch Distribution ───────────────────────────────────────────
    /**
     * @notice Distribui recompensas da epoch para mineradores ativos.
     * @dev Chamada pelo operador (API server) ao final de cada epoch.
     *      Arrays devem ter o mesmo tamanho. uptimeShares são em basis points (0-10000).
     *
     * @param activeMiners   Lista de wallets que estiveram online na epoch
     * @param uptimeShares   Share proporcional de cada minerador em basis points
     *                       (soma deve ser <= 10000, representando 100%)
     */
    function distributeEpochRewards(
        address[] calldata activeMiners,
        uint256[] calldata uptimeShares
    ) external onlyOperator {
        require(activeMiners.length == uptimeShares.length, "Arrays de tamanho diferente");
        require(activeMiners.length > 0, "Nenhum minerador ativo");

        currentDistributionEpoch++;
        uint256 totalPaid = 0;

        for (uint256 i = 0; i < activeMiners.length; i++) {
            address miner = activeMiners[i];
            require(miners[miner].isRegistered, "Minerador nao registrado");
            require(uptimeShares[i] <= 10000, "Share acima de 100%");

            // Calcula recompensa proporcional ao uptime share
            uint256 reward = (MAX_EPOCH_DISTRIBUTION * uptimeShares[i]) / 10000;
            if (reward == 0) continue;

            totalPaid += reward;
            require(totalPaid <= MAX_EPOCH_DISTRIBUTION, "Distribuicao excede quota da epoch");

            miners[miner].totalEarned += reward;
            miners[miner].epochsActive++;
            miners[miner].lastRewardEpoch = uint64(currentDistributionEpoch);

            // Minta tokens diretamente para o minerador
            claimToken.mintForClaim(miner, reward);

            emit RewardPaid(miner, currentDistributionEpoch, reward, uptimeShares[i]);
        }

        totalDistributed += totalPaid;
        emit EpochDistributed(currentDistributionEpoch, activeMiners.length, totalPaid);
    }

    // ─── Views ────────────────────────────────────────────────────────
    function getMinerStats(address miner) external view returns (
        bool isRegistered,
        uint256 totalEarned,
        uint256 epochsActive,
        uint64 registeredAt,
        uint64 lastRewardEpoch
    ) {
        MinerInfo memory m = miners[miner];
        return (m.isRegistered, m.totalEarned, m.epochsActive, m.registeredAt, m.lastRewardEpoch);
    }

    function getTotalMiners() external view returns (uint256) {
        return minerList.length;
    }

    function getNetworkStats() external view returns (
        uint256 totalMiners,
        uint256 totalDistributedAmount,
        uint256 currentEpoch
    ) {
        return (minerList.length, totalDistributed, currentDistributionEpoch);
    }
}
