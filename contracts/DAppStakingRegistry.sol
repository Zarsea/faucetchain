// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DAppStakingRegistry {
    // FaucetChain Frontend mentions: "ativos 10,000 CLAIM para ativar Hub"
    uint256 public constant MIN_STAKE_REQUIRED = 10_000 * 10**18; 
    
    // O token CLAIM que o dApp usa pra pagar o passaporte
    IERC20 public claimToken;

    struct FaucetDApp {
        address owner;
        uint256 stakedAmount;
        bool isActive;
        string endpointURL;
    }

    mapping(address => FaucetDApp) public registeredFaucets;

    event FaucetPluggada(address indexed faucetOwner, uint256 stakedAmount);

    constructor(address _claimTokenAddress) {
        claimToken = IERC20(_claimTokenAddress);
    }

    // Conexão do DApp à rede via STAKE: Passaporte de Inserção
    function plugFaucet(string memory _endpoint, uint256 _amount) external { 
        require(_amount >= MIN_STAKE_REQUIRED, "Stake insuficiente para conectar DApp");
        
        // Faucet needs to have approved this contract beforehand
        claimToken.transferFrom(msg.sender, address(this), _amount);

        // Se já existir, soma; senão, cria e ativa.
        registeredFaucets[msg.sender].owner = msg.sender;
        registeredFaucets[msg.sender].stakedAmount += _amount;
        registeredFaucets[msg.sender].isActive = true;
        registeredFaucets[msg.sender].endpointURL = _endpoint;
        
        emit FaucetPluggada(msg.sender, _amount);
    }

    function isAuthorizedFaucet(address _faucet) external view returns (bool) {
        return registeredFaucets[_faucet].isActive && registeredFaucets[_faucet].stakedAmount >= MIN_STAKE_REQUIRED;
    }
}
