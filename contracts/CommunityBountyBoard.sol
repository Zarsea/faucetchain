// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CommunityBountyBoard
 * @notice Quadro de bounties comunitário para a FaucetChain.
 *         Usuários criam bounties travando $CLAIM como recompensa.
 *         Hunters completam tarefas e recebem os tokens ao serem aprovados.
 *
 *         Ciclo de vida:
 *           OPEN → CLAIMED → COMPLETED (pago)
 *           OPEN → CANCELLED (expirado, tokens devolvidos)
 */
contract CommunityBountyBoard is ReentrancyGuard {

    // ─── Types ────────────────────────────────────────────────────────
    enum BountyStatus { OPEN, CLAIMED, COMPLETED, CANCELLED }

    struct Bounty {
        address creator;
        address hunter;         // quem aceitou a bounty
        string  title;
        string  description;
        uint256 reward;         // CLAIM travado
        uint256 createdAt;
        uint256 deadline;       // timestamp limite
        BountyStatus status;
    }

    // ─── State ────────────────────────────────────────────────────────
    IERC20 public claimToken;

    uint256 public nextBountyId;
    mapping(uint256 => Bounty) public bounties;

    uint256 public totalBountiesCreated;
    uint256 public totalRewardsPaid;
    uint256 public totalActiveBounties;

    // ─── Events ───────────────────────────────────────────────────────
    event BountyCreated(
        uint256 indexed bountyId,
        address indexed creator,
        string title,
        uint256 reward,
        uint256 deadline
    );
    event BountyClaimed(uint256 indexed bountyId, address indexed hunter);
    event BountyApproved(uint256 indexed bountyId, address indexed hunter, uint256 reward);
    event BountyCancelled(uint256 indexed bountyId, address indexed creator, uint256 refund);

    // ─── Constructor ──────────────────────────────────────────────────
    constructor(address _claimToken) {
        claimToken = IERC20(_claimToken);
    }

    // ─── Core: Create Bounty ──────────────────────────────────────────
    /**
     * @notice Cria uma bounty travando CLAIM como recompensa.
     * @param title       Título curto da tarefa
     * @param description Descrição detalhada
     * @param reward      Quantidade de CLAIM oferecida
     * @param duration    Duração em segundos até expirar
     */
    function createBounty(
        string calldata title,
        string calldata description,
        uint256 reward,
        uint256 duration
    ) external nonReentrant returns (uint256 bountyId) {
        require(reward > 0, "Recompensa deve ser > 0");
        require(duration >= 1 hours, "Duracao minima: 1 hora");
        require(bytes(title).length > 0, "Titulo obrigatorio");

        require(
            claimToken.transferFrom(msg.sender, address(this), reward),
            "Falha na transferencia de CLAIM"
        );

        bountyId = nextBountyId++;

        bounties[bountyId] = Bounty({
            creator:     msg.sender,
            hunter:      address(0),
            title:       title,
            description: description,
            reward:      reward,
            createdAt:   block.timestamp,
            deadline:    block.timestamp + duration,
            status:      BountyStatus.OPEN
        });

        totalBountiesCreated++;
        totalActiveBounties++;

        emit BountyCreated(bountyId, msg.sender, title, reward, block.timestamp + duration);
    }

    // ─── Core: Claim Bounty (Hunter aceita) ───────────────────────────
    /**
     * @notice Hunter se candidata para completar a bounty.
     */
    function claimBounty(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        require(b.status == BountyStatus.OPEN, "Bounty nao esta aberta");
        require(block.timestamp < b.deadline, "Bounty expirada");
        require(msg.sender != b.creator, "Criador nao pode se auto-candidatar");

        b.hunter = msg.sender;
        b.status = BountyStatus.CLAIMED;

        emit BountyClaimed(bountyId, msg.sender);
    }

    // ─── Core: Approve (Criador aprova e paga) ────────────────────────
    /**
     * @notice Criador aprova o trabalho do hunter e libera a recompensa.
     */
    function approveBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.creator, "Apenas o criador pode aprovar");
        require(b.status == BountyStatus.CLAIMED, "Bounty nao esta em revisao");

        b.status = BountyStatus.COMPLETED;
        totalActiveBounties--;
        totalRewardsPaid += b.reward;

        require(
            claimToken.transfer(b.hunter, b.reward),
            "Falha no pagamento ao hunter"
        );

        emit BountyApproved(bountyId, b.hunter, b.reward);
    }

    // ─── Core: Cancel (Criador cancela se expirou) ────────────────────
    /**
     * @notice Cancela bounty expirada e devolve CLAIM ao criador.
     *         Só pode cancelar se expirou E ninguém está trabalhando nela.
     */
    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage b = bounties[bountyId];
        require(msg.sender == b.creator, "Apenas o criador pode cancelar");
        require(
            b.status == BountyStatus.OPEN || 
            (b.status == BountyStatus.CLAIMED && block.timestamp > b.deadline),
            "Cancelamento nao permitido neste estado"
        );

        b.status = BountyStatus.CANCELLED;
        totalActiveBounties--;

        require(
            claimToken.transfer(b.creator, b.reward),
            "Falha no reembolso"
        );

        emit BountyCancelled(bountyId, b.creator, b.reward);
    }

    // ─── Views ────────────────────────────────────────────────────────

    /**
     * @notice Retorna detalhes completos de uma bounty.
     */
    function getBountyDetails(uint256 bountyId) external view returns (
        address creator,
        address hunter,
        string memory title,
        string memory description,
        uint256 reward,
        uint256 createdAt,
        uint256 deadline,
        BountyStatus status,
        bool isExpired
    ) {
        Bounty memory b = bounties[bountyId];
        return (
            b.creator,
            b.hunter,
            b.title,
            b.description,
            b.reward,
            b.createdAt,
            b.deadline,
            b.status,
            block.timestamp > b.deadline
        );
    }
}
