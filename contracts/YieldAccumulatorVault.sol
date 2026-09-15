// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract YieldAccumulatorVault {
    
    // Lista de tokens suportados que o Vault absorve (Moedas de redes PoS inflacionárias)
    mapping(address => bool) public supportedPoSTokens;
    
    // O rendimento gerado internamente será redirecionado/dividido conforme
    // a aprovação da Governança Sentinel/Validator
    address public treasuryWallet;
    
    address public governanceOwner;

    struct StakerPosition {
        uint256 amountStaked;
        uint256 yieldCredit;
    }

    // Tokens => User => Position
    mapping(address => mapping(address => StakerPosition)) public foreignStakes;

    event ExternalAssetStaked(address indexed user, address indexed token, uint256 amount);
    event SupportedTokenAdded(address indexed token);
    event YieldDistributed(address indexed token, uint256 totalYieldGenerated);

    constructor(address _treasury) {
        treasuryWallet = _treasury;
        governanceOwner = msg.sender;
    }

    modifier onlyGovernance() {
        require(msg.sender == governanceOwner, "Apenas governanca Sentinel");
        _;
    }

    function addSupportedToken(address token) external onlyGovernance {
        supportedPoSTokens[token] = true;
        emit SupportedTokenAdded(token);
    }

    // Cofre recebe tokens externos depreveciados na chain vizinha e protege
    function stakeExternalAsset(address token, uint256 amount) external {
        require(supportedPoSTokens[token], "Token PoS nao suportado pelo Vault");
        
        // Transferência do ativo externo empacotado para o cofre da FaucetChain
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Falha na transferencia");
        
        foreignStakes[token][msg.sender].amountStaked += amount;
        emit ExternalAssetStaked(msg.sender, token, amount);
    }

    // A Rede usa oráculos ou bridges integradas para pegar esse montante,
    // fazer yields complexos off-chain / cross-chain, e quando retorna o lucro:
    function distributeYield(address token, uint256 totalYieldGenerated) external onlyGovernance {
        // Redirecionamento da fatia do lucro
        // Parte alimenta a própria economia do $CLAIM
        // Outra parte rende para as Faucets parceiras, amortizando as quedas nos mercados delas
        emit YieldDistributed(token, totalYieldGenerated);
    }
}
