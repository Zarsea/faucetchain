// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FaucetToken_CLAIM is ERC20 {
    uint256 public constant MAX_SUPPLY = 99_000_000 * 10**18;
    
    // Controlador das Epochs Horárias
    address public hourlyEpochManager;

    // Deployer do token — único autorizado a definir o epoch manager
    address public immutable deployer;

    // Emitted when user optionally burns tokens
    event OptionalBurnExecutado(address indexed burner, uint256 amount);

    constructor() ERC20("FaucetChain Claim", "CLAIM") {
        deployer = msg.sender;
    }

    // Fase C: restrito ao deployer (antes qualquer um podia chamar primeiro —
    // janela de front-running no deploy)
    function setHourlyEpochManager(address _manager) external {
        require(msg.sender == deployer, "Restrito ao deployer");
        require(hourlyEpochManager == address(0), "Manager already set");
        require(_manager != address(0), "Manager invalido");
        hourlyEpochManager = _manager;
    }

    // Apenas o Epoch Manager tem permissão para cunhar (Proof of Claim mineration)
    function mintForClaim(address to, uint256 amount) external {
        require(msg.sender == hourlyEpochManager, "Restrito ao motor PoC");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply atingido");
        _mint(to, amount);
    }

    // Cumprindo a regra V3: Ausência de Auto-Burn. APENAS Opt-in Burn.
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
        // Emissão de evento gamificado para usuários que queimam voluntariamente
        emit OptionalBurnExecutado(msg.sender, amount);
    }
}
