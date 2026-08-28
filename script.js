import { GameEngine } from './core/GameEngine.js';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { LocalPrices } from './prices/LocalPrices.js';

const storage = new LocalStorageAdapter();
const GAME_ID = 'my_game';

let prices = null;
let gameData = null;

const gameEngine = new GameEngine(storage, prices);

function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

async function loadTickersCsv() {
    const url = 'prices/tickers.csv';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Не удалось загрузить tickers.csv');

    const text = await res.text();
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const map = {};

    for (const line of lines) {
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 3) continue;

        const year = parts[0].trim();
        const name = parts[1].trim();
        const ticker = parts[2].trim();

        if (!/^\d{4}$/.test(year)) continue;
        if (!map[year]) map[year] = [];

        map[year].push({ Name: name, Ticker: ticker });
    }

    return map;
}

function buildSelectedTickers(rows) {
    const trailingSpecialRows = rows.slice(-5);
    const stockPool = rows.slice(5, rows.length - 5);

    const bankTicker = trailingSpecialRows.find((row) => /BANK/i.test(row.Ticker) || /BANK/i.test(row.Name))?.Ticker || 'BANK';
    const usdTicker = trailingSpecialRows.find((row) => /USD/i.test(row.Ticker) || /USD/i.test(row.Name))?.Ticker || 'USD';

    const fundTickers = trailingSpecialRows
        .filter((row) => {
            const ticker = row.Ticker || '';
            const name = row.Name || '';
            return !/BANK|USD|GLDRUB|GOLD/i.test(ticker)
                && !/BANK|USD|GLDRUB|GOLD/i.test(name)
                && (ticker.length > 8 || /FUND|ФОНД|EQ|JR|RU000/i.test(name) || /FUND|ФОНД|EQ|JR|RU000/i.test(ticker));
        })
        .map((row) => row.Ticker)
        .slice(0, 2);

    const stockCandidates = stockPool.map((row) => row.Ticker).filter(Boolean);
    const stockCount = Math.min(3, stockCandidates.length);
    const stocks = shuffleArray(stockCandidates).slice(0, stockCount);

    const bondCandidates = rows.slice(0, 5).map((row) => row.Ticker).filter(Boolean);
    const first = bondCandidates[0] || 'OFZ';
    const secondOrThird = bondCandidates[Math.random() < 0.5 ? 1 : 2] || 'BONDS';
    const fourthOrFifth = bondCandidates[Math.random() < 0.5 ? 3 : 4] || 'VDO';

    const goldTicker = trailingSpecialRows.find((row) => /GLDRUB|GOLD/i.test(row.Ticker) || /GLDRUB|GOLD/i.test(row.Name))?.Ticker || 'GLDRUB_TOM';

    return {
        bonds: [first, secondOrThird, fourthOrFifth].filter(Boolean),
        stocks,
        others: [usdTicker, ...fundTickers, goldTicker].filter(Boolean).slice(0, 4),
        bankTicker
    };
}

async function ensureTickerSelection() {
    if (!gameData) {
        await loadGame();
    }

    if (gameData.selectedTickers && gameData.year) {
        return gameData.selectedTickers;
    }

    try {
        const csvMap = await loadTickersCsv();
        const years = Object.keys(csvMap);
        if (!years.length) {
            gameData.selectedTickers = {
                bonds: ['OFZ', 'BONDS', 'VDO'],
                stocks: ['SBER', 'GAZP', 'YNDX'],
                others: ['USD', 'GLDRUB_TOM'],
                bankTicker: 'BANK'
            };
            gameData.year = '2024';
            return gameData.selectedTickers;
        }

        const randomYear = years[Math.floor(Math.random() * years.length)];
        const rows = csvMap[randomYear] || [];
        const selectedTickers = buildSelectedTickers(rows);

        gameData.year = randomYear;
        gameData.selectedTickers = selectedTickers;

        prices = await LocalPrices.create(randomYear);
        gameEngine.prices = prices;

        return selectedTickers;
    } catch (err) {
        console.warn('Не удалось загрузить tickers.csv', err);
        gameData.year = gameData.year || '2024';
        gameData.selectedTickers = {
            bonds: ['OFZ', 'BONDS', 'VDO'],
            stocks: ['SBER', 'GAZP', 'YNDX'],
            others: ['USD', 'GLDRUB_TOM'],
            bankTicker: 'BANK'
        };
        return gameData.selectedTickers;
    }
}

function createNewGame() {
    return {
        portfolio: {
            cash: 10000,
            assets: {},
            assetValues: {},
            deposits: {},
            bankAccount: { balance: 0, rate: 0.06 }
        },
        currentDay: 1,
        history: [],
        monthlyEvents: {},
        pendingEvent: null
    };
}

async function loadGame() {
    const saved = await storage.loadGame(GAME_ID);
    if (saved) {
        gameData = saved;
        if (saved.year) {
            prices = await LocalPrices.create(saved.year);
            gameEngine.prices = prices;
        }
        return gameData;
    }

    gameData = createNewGame();
    await ensureTickerSelection();
    await storage.saveGame(GAME_ID, gameData);
    return gameData;
}

async function initializeGame() {
    if (!gameData) {
        await loadGame();
    }

    if (!gameData.selectedTickers) {
        await ensureTickerSelection();
    }

    if (!prices) {
        const year = gameData?.year || '2024';
        prices = await LocalPrices.create(year);
        gameEngine.prices = prices;
    }

    return gameData;
}

async function resetGame() {
    await storage.deleteGame(GAME_ID);
    gameData = createNewGame();
    await storage.saveGame(GAME_ID, gameData);
    return gameData;
}

window.game = {
    data: () => gameData,
    engine: gameEngine,
    getPrices: () => prices,
    initialize: initializeGame,
    reset: resetGame
};

if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        void initializeGame();
    });
}