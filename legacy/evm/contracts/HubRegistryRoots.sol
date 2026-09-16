// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title HubRegistryRoots
/// @notice Registro on-chain de Hubs + commitments (Merkle roots) por epoch.
/// @dev Contratos não chamam APIs HTTP; a API do Hub é off-chain. O on-chain serve
///      como fonte de verdade para: operador, URL, chave pública e roots publicados.
contract HubRegistryRoots {
    struct Hub {
        address operator;
        string apiBaseUrl;    // ex: https://hub1.example.com
        bytes pubKey;         // chave pública (formato definido pelo Hub/Explorer)
        string metadataURI;   // opcional (IPFS/HTTPS)
        bool active;
        uint64 lastHeartbeat;
    }

    struct EpochRoot {
        bytes32 root;         // keccak-merkle root
        uint64 startHeight;   // inclusive
        uint64 endHeight;     // inclusive
        uint64 leafCount;
        uint64 publishedAt;
    }

    mapping(bytes32 => Hub) public hubs;
    mapping(bytes32 => mapping(uint64 => EpochRoot)) public epochRoots; // hubId => epochId => root

    event HubRegistered(bytes32 indexed hubId, address indexed operator, string apiBaseUrl);
    event HubUpdated(bytes32 indexed hubId, string apiBaseUrl, string metadataURI, bytes pubKey);
    event HubStatus(bytes32 indexed hubId, bool active);
    event HubHeartbeat(bytes32 indexed hubId, uint64 ts);

    event EpochRootPublished(
        bytes32 indexed hubId,
        uint64 indexed epochId,
        uint64 startHeight,
        uint64 endHeight,
        uint64 leafCount,
        bytes32 root
    );

    modifier onlyOperator(bytes32 hubId) {
        require(hubs[hubId].operator == msg.sender, "not operator");
        _;
    }

    function registerHub(
        bytes32 hubId,
        string calldata apiBaseUrl,
        bytes calldata pubKey,
        string calldata metadataURI
    ) external {
        Hub storage h = hubs[hubId];
        require(h.operator == address(0), "hubId already used");
        hubs[hubId] = Hub({
            operator: msg.sender,
            apiBaseUrl: apiBaseUrl,
            pubKey: pubKey,
            metadataURI: metadataURI,
            active: true,
            lastHeartbeat: uint64(block.timestamp)
        });
        emit HubRegistered(hubId, msg.sender, apiBaseUrl);
    }

    function updateHub(
        bytes32 hubId,
        string calldata apiBaseUrl,
        bytes calldata pubKey,
        string calldata metadataURI
    ) external onlyOperator(hubId) {
        Hub storage h = hubs[hubId];
        h.apiBaseUrl = apiBaseUrl;
        h.pubKey = pubKey;
        h.metadataURI = metadataURI;
        emit HubUpdated(hubId, apiBaseUrl, metadataURI, pubKey);
    }

    function setActive(bytes32 hubId, bool active) external onlyOperator(hubId) {
        hubs[hubId].active = active;
        emit HubStatus(hubId, active);
    }

    function heartbeat(bytes32 hubId) external onlyOperator(hubId) {
        hubs[hubId].lastHeartbeat = uint64(block.timestamp);
        emit HubHeartbeat(hubId, hubs[hubId].lastHeartbeat);
    }

    /// @notice Publica o Merkle root de um epoch de blocos indexados pelo Hub.
    /// @dev O Explorer verifica provas contra este root. O contrato não valida
    ///      a prova (isso é custo alto); ele apenas ancora o commitment.
    function publishEpochRoot(
        bytes32 hubId,
        uint64 epochId,
        uint64 startHeight,
        uint64 endHeight,
        uint64 leafCount,
        bytes32 root
    ) external onlyOperator(hubId) {
        require(leafCount > 0, "leafCount=0");
        require(endHeight >= startHeight, "bad range");
        epochRoots[hubId][epochId] = EpochRoot({
            root: root,
            startHeight: startHeight,
            endHeight: endHeight,
            leafCount: leafCount,
            publishedAt: uint64(block.timestamp)
        });
        emit EpochRootPublished(hubId, epochId, startHeight, endHeight, leafCount, root);
    }
}

