// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DAppStakingRegistry.sol";
import "./FaucetToken_CLAIM.sol";

contract HourlyEpochManager {
    uint256 public constant EPOCH_DURATION = 1 hours;
    
    // Fração de emissão do bloco global de 1 hora
    uint256 public constant TOKENS_PER_HOUR = 2_000 * 10**18;
    
    struct EpochInfo {
        uint256 tokensMined;
        bool isDepleted;
    }
    
    uint256 public currentEpochStartTime;
    uint256 public currentEpochId;
    
    mapping(uint256 => EpochInfo) public epochData;
    
    DAppStakingRegistry public registry;
    FaucetToken_CLAIM public claimToken;

    event BlocoEsgotadoAntesDoTempo(uint256 epochId);
    event EpochRollover(uint256 oldEpochId, uint256 newEpochId, uint256 startTime);

    constructor(address _registryAddress, address _claimTokenAddress) {
        registry = DAppStakingRegistry(_registryAddress);
        claimToken = FaucetToken_CLAIM(_claimTokenAddress);
        currentEpochStartTime = block.timestamp;
        currentEpochId = 1;
    }

    function _checkAndRolloverEpoch() internal {
        if (block.timestamp >= currentEpochStartTime + EPOCH_DURATION) {
            uint256 oldEpoch = currentEpochId;
            currentEpochId++;
            // Avançar a hora precisamente, não pular janelas de hiato se ocioso
            // ou apenas resetar starttime pro novo bloco: 
            currentEpochStartTime = block.timestamp; 
            emit EpochRollover(oldEpoch, currentEpochId, currentEpochStartTime);
        }
    }

    // Funcionalidade Core: A "Clamação" que gera a moeda
    function processClaim(address userWallet, uint256 claimAmount) external {
        // Verifica se quem chama é uma Faucet autorizada com Stake Ativo
        require(registry.isAuthorizedFaucet(msg.sender), "Faucet nao possui Stake ou invalida");
        
        _checkAndRolloverEpoch();
        
        // Regra do HIATO: Se o bloco/hora esgotou, TRAVA a mineração até a próxima hora
        require(!epochData[currentEpochId].isDepleted, "Bloco_Horario esgotado. Aguarde a proxima hora!");
        require(epochData[currentEpochId].tokensMined + claimAmount <= TOKENS_PER_HOUR, "Quantidade excede limite da hora");

        epochData[currentEpochId].tokensMined += claimAmount;
        
        if (epochData[currentEpochId].tokensMined == TOKENS_PER_HOUR) {
            epochData[currentEpochId].isDepleted = true; // Bloco fully explored
            emit BlocoEsgotadoAntesDoTempo(currentEpochId);
        }

        // Mineração efetiva feita pelo ato do Claim na faucet
        claimToken.mintForClaim(userWallet, claimAmount);
    }
}
