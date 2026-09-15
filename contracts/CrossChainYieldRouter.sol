// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CrossChainYieldRouter
 * @dev Conceptually routes native $CLAIM into cross-chain DeFi yield protocols.
 *      This contract acts as the L1 settlement layer for the Yield Economics hub.
 */
contract CrossChainYieldRouter {
    address public treasuryAdmin;
    uint256 public totalValueLocked;

    struct YieldStrategy {
        string protocolId; // e.g., "lido_eth", "aave_usdc"
        uint256 totalAllocated;
        uint256 projectedAPY;
        bool isActive;
    }

    mapping(string => YieldStrategy) public activeStrategies;
    mapping(address => mapping(string => uint256)) public userStakes;

    event StrategyAdded(string protocolId, uint256 apy);
    event Staked(address indexed user, string protocolId, uint256 amount);
    event Unstaked(address indexed user, string protocolId, uint256 amount, uint256 yieldEarned);
    event YieldReinvested(uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == treasuryAdmin, "Not Authorized");
        _;
    }

    constructor() {
        treasuryAdmin = msg.sender;
    }

    /**
     * @dev Initialize a new external strategy on the router
     */
    function addStrategy(string memory _protocolId, uint256 _apy) external onlyAdmin {
        activeStrategies[_protocolId] = YieldStrategy({
            protocolId: _protocolId,
            totalAllocated: 0,
            projectedAPY: _apy,
            isActive: true
        });
        emit StrategyAdded(_protocolId, _apy);
    }

    /**
     * @dev Users lock $CLAIM here. 
     *      Off-chain oracles detect this lock and mint/allocate wrapped assets on target networks.
     */
    function stake(string memory _protocolId) external payable {
        require(activeStrategies[_protocolId].isActive, "Strategy inactive");
        require(msg.value > 0, "Must stake CLAIM");

        userStakes[msg.sender][_protocolId] += msg.value;
        activeStrategies[_protocolId].totalAllocated += msg.value;
        totalValueLocked += msg.value;

        emit Staked(msg.sender, _protocolId, msg.value);
    }

    /**
     * @dev Unstake funds. The yield generated is resolved via oracle settlement.
     */
    function unstake(string memory _protocolId, uint256 _amount, uint256 _yieldSettlement) external {
        require(userStakes[msg.sender][_protocolId] >= _amount, "Insufficient stake");
        
        // Update local ledger
        userStakes[msg.sender][_protocolId] -= _amount;
        activeStrategies[_protocolId].totalAllocated -= _amount;
        totalValueLocked -= _amount;

        // Transfer raw $CLAIM back + oracle settled yield
        uint256 totalReturn = _amount + _yieldSettlement;
        (bool success, ) = payable(msg.sender).call{value: totalReturn}("");
        require(success, "Transfer failed");

        emit Unstaked(msg.sender, _protocolId, _amount, _yieldSettlement);
    }

    // Fallback to receive ecosystem yield injections
    receive() external payable {
        emit YieldReinvested(msg.value);
    }
}
