
/**
 * Represents a validator in the simulation.
 */
export interface Validator {
    id: number;
    pocWeight: number;
    posStake: number;
    hybridWeight: number;
    status: 'online' | 'offline' | 'malicious';
}

/**
 * The results of a single simulation run.
 */
export interface SimulationResult {
    validators: Validator[];
    powerDistribution: { name: string; value: number }[];
    weightDistribution: { bin: string; count: number }[];
    healthDistribution: { name: string; value: number; color: string }[];
    giniCoefficient: number;
    stabilityScore: number;
    activeNodes: number;
}

/**
 * Defines the sections available in the code viewer.
 */
export type CodeSection = 'Smart Contract' | 'AI Module';

/**
 * Information about a specific wallet.
 */
export interface WalletInfo {
    address: string;
    balanceClaim: number;
    balanceUsdc: number;
    balanceUsdt: number;
    reputationScore: number;
    stakedAmount: number;
    lastActivity: number;
    isValidator: boolean;
    rank: number;
}

declare global {
    interface Window {
        ethereum: any;
    }
}
