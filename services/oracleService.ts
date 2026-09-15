/**
 * FaucetChain Oracle Service — Chainlink Data Feed Compatible
 *
 * Fetches real-time cryptocurrency prices from CryptoCompare API (free, no key required).
 * This mirrors the data that Chainlink Price Feeds provide on-chain, and can be replaced
 * with a direct on-chain Chainlink ABI call when a mainnet RPC is available.
 *
 * Chainlink Reference Feeds (Ethereum Mainnet):
 *  - ETH/USD:  0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419
 *  - BTC/USD:  0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88b
 *  - BNB/USD:  0x14e613AC84a31f709eadbEF3cef7651D5C243500
 *  - LINK/USD: 0x2c1d072e956AFFC0D435Cb7AC308d97936Ed4051
 *
 * For local/testnet environments, we proxy through CryptoCompare's public REST API.
 * "Powered by Chainlink" badge is shown to indicate the production architecture.
 */

export interface OraclePrice {
    pair: string;
    price: number;
    change24h: number;
    changePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    source: 'chainlink' | 'cryptocompare' | 'mock';
    lastUpdated: number;
    chainlinkFeedAddress?: string;
}

// Chainlink mainnet feed addresses for reference
const CHAINLINK_FEEDS: Record<string, string> = {
    'ETH/USD':  '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'BTC/USD':  '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88b',
    'BNB/USD':  '0x14e613AC84a31f709eadbEF3cef7651D5C243500',
    'MATIC/USD':'0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c1a57a95',
    'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC308d97936Ed4051',
    'SOL/USD':  '0x4ffC43a60e009B551865A93d232E33Fce9f01507',
};

// In-memory cache (60 seconds TTL)
const CACHE_TTL_MS = 60_000;
const priceCache: Map<string, { data: OraclePrice; expires: number }> = new Map();

// Mock fallback prices (for when API is unavailable)
const MOCK_PRICES: Record<string, Partial<OraclePrice>> = {
    'ETH/USD':  { price: 3_421.50, change24h: 45.20, changePercent24h: 1.34, high24h: 3_510.00, low24h: 3_380.00, volume24h: 12_345_678 },
    'BTC/USD':  { price: 67_850.00, change24h: -320.00, changePercent24h: -0.47, high24h: 68_200.00, low24h: 67_100.00, volume24h: 34_567_890 },
    'BNB/USD':  { price: 592.30, change24h: 8.10, changePercent24h: 1.38, high24h: 598.00, low24h: 580.00, volume24h: 2_345_678 },
    'MATIC/USD':{ price: 0.9124, change24h: -0.0123, changePercent24h: -1.33, high24h: 0.9350, low24h: 0.9000, volume24h: 456_789 },
    'LINK/USD': { price: 18.43, change24h: 0.32, changePercent24h: 1.77, high24h: 18.90, low24h: 18.10, volume24h: 1_234_567 },
    'SOL/USD':  { price: 178.60, change24h: 3.40, changePercent24h: 1.94, high24h: 182.00, low24h: 175.20, volume24h: 5_678_901 },
};

function buildMockPrice(pair: string): OraclePrice {
    const mock = MOCK_PRICES[pair] || { price: 0, change24h: 0, changePercent24h: 0, high24h: 0, low24h: 0, volume24h: 0 };
    return {
        pair,
        price: mock.price ?? 0,
        change24h: mock.change24h ?? 0,
        changePercent24h: mock.changePercent24h ?? 0,
        high24h: mock.high24h ?? 0,
        low24h: mock.low24h ?? 0,
        volume24h: mock.volume24h ?? 0,
        source: 'mock',
        lastUpdated: Date.now(),
        chainlinkFeedAddress: CHAINLINK_FEEDS[pair],
    };
}

/**
 * Fetches a single price pair from CryptoCompare REST API.
 * CryptoCompare is the data provider behind many Chainlink price feeds.
 */
async function fetchFromCryptoCompare(pair: string): Promise<OraclePrice> {
    const [base, quote] = pair.split('/');
    const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${base}&tsyms=${quote}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        const raw = json?.RAW?.[base]?.[quote];

        if (!raw) throw new Error('Missing data in response');

        return {
            pair,
            price: raw.PRICE ?? 0,
            change24h: raw.CHANGE24HOUR ?? 0,
            changePercent24h: raw.CHANGEPCT24HOUR ?? 0,
            high24h: raw.HIGH24HOUR ?? 0,
            low24h: raw.LOW24HOUR ?? 0,
            volume24h: raw.VOLUME24HOURTO ?? 0,
            source: 'cryptocompare',
            lastUpdated: Date.now(),
            chainlinkFeedAddress: CHAINLINK_FEEDS[pair],
        };
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

/**
 * Fetches price for a given pair with caching.
 * Falls back to mock data if the API is unavailable.
 */
export async function fetchOraclePrice(pair: string): Promise<OraclePrice> {
    const cached = priceCache.get(pair);
    if (cached && Date.now() < cached.expires) {
        return cached.data;
    }

    try {
        const data = await fetchFromCryptoCompare(pair);
        priceCache.set(pair, { data, expires: Date.now() + CACHE_TTL_MS });
        return data;
    } catch {
        // Graceful fallback to mock
        const mock = buildMockPrice(pair);
        // Cache mock for shorter time (10s) so it retries sooner
        priceCache.set(pair, { data: mock, expires: Date.now() + 10_000 });
        return mock;
    }
}

/**
 * Fetches multiple pairs in parallel with a single API call when possible.
 */
export async function fetchMultipleOraclePrices(pairs: string[]): Promise<OraclePrice[]> {
    // Check if all are cached
    const results: (OraclePrice | null)[] = pairs.map(pair => {
        const cached = priceCache.get(pair);
        return cached && Date.now() < cached.expires ? cached.data : null;
    });

    const uncachedPairs = pairs.filter((_, i) => results[i] === null);

    if (uncachedPairs.length > 0) {
        try {
            // Batch fetch from CryptoCompare
            const bases = [...new Set(uncachedPairs.map(p => p.split('/')[0]))];
            const quotes = [...new Set(uncachedPairs.map(p => p.split('/')[1]))];
            const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${bases.join(',')}&tsyms=${quotes.join(',')}`;

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);

            if (res.ok) {
                const json = await res.json();

                uncachedPairs.forEach((pair, idx) => {
                    const [base, quote] = pair.split('/');
                    const raw = json?.RAW?.[base]?.[quote];
                    const pairIdx = pairs.indexOf(pair);

                    if (raw) {
                        const data: OraclePrice = {
                            pair,
                            price: raw.PRICE ?? 0,
                            change24h: raw.CHANGE24HOUR ?? 0,
                            changePercent24h: raw.CHANGEPCT24HOUR ?? 0,
                            high24h: raw.HIGH24HOUR ?? 0,
                            low24h: raw.LOW24HOUR ?? 0,
                            volume24h: raw.VOLUME24HOURTO ?? 0,
                            source: 'cryptocompare',
                            lastUpdated: Date.now(),
                            chainlinkFeedAddress: CHAINLINK_FEEDS[pair],
                        };
                        priceCache.set(pair, { data, expires: Date.now() + CACHE_TTL_MS });
                        results[pairIdx] = data;
                    } else {
                        const mock = buildMockPrice(pair);
                        priceCache.set(pair, { data: mock, expires: Date.now() + 10_000 });
                        results[pairIdx] = mock;
                    }
                });
            } else {
                // Fallback all uncached to mock
                uncachedPairs.forEach(pair => {
                    const pairIdx = pairs.indexOf(pair);
                    const mock = buildMockPrice(pair);
                    priceCache.set(pair, { data: mock, expires: Date.now() + 10_000 });
                    results[pairIdx] = mock;
                });
            }
        } catch {
            // Network error — use mocks for all uncached
            uncachedPairs.forEach(pair => {
                const pairIdx = pairs.indexOf(pair);
                const mock = buildMockPrice(pair);
                priceCache.set(pair, { data: mock, expires: Date.now() + 10_000 });
                results[pairIdx] = mock;
            });
        }
    }

    return results.map((r, i) => r ?? buildMockPrice(pairs[i]));
}

/** Clears the entire price cache (useful for forcing refresh) */
export function clearOracleCache(): void {
    priceCache.clear();
}

/** Returns all currently cached prices */
export function getCachedPrices(): OraclePrice[] {
    return Array.from(priceCache.values())
        .filter(entry => Date.now() < entry.expires)
        .map(entry => entry.data);
}
