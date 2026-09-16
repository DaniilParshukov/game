import { GameEngine } from './core/GameEngine.js';
import { LocalStorageAdapter } from './core/LocalStorageAdapter.js';
import { LocalPrices } from './prices/LocalPrices.js';

const storage = new LocalStorageAdapter();
globalThis.CopilkaStorage = LocalStorageAdapter;

let gameEngine = null;
let prices = null;
let gameInitializationPromise = null;

let gameData = {
        portfolio: {
            cash: 10000,
            assets: {},
            assetValues: {},
            bankBalance: 0
        },
        date: getGameStartDate(2007),
        history: [],
        monthlyEvents: {},
        pendingEvent: null
    };

const gameClock = {
    intervalMs: 3000,
    timerId: null,
    isPaused: true
};



function getGameStartDate(year) {
    const safeYear = Number(year) || 2007;
    return new Date(safeYear, 8, 1);
}

async function ensureGameReady() {
    if (!gameInitializationPromise) {
        gameInitializationPromise = initializeGame();
    }
    return gameInitializationPromise;
}

function resumeGameAfterContinue() {
    return ensureGameReady()
        .then(() => {
            setPauseState(true);
            if (typeof window.showPage === 'function') {
                window.showPage('portfolio');
            }
        })
        .catch((error) => {
            console.error('Не удалось инициализировать игру после продолжения:', error);
            setPauseState(true);
            if (typeof window.showPage === 'function') {
                window.showPage('portfolio');
            }
        });
}

function updateDayBadge() {
    const badge = document.querySelector('.day-badge');
    if (!badge || !gameData) return;
    const safeDate = normalizeDateValue(gameData.date || getGameStartDate(Number(gameData.year) || 2007), Number(gameData.year) || 2007);
    const year = Number(safeDate.getFullYear());
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    const day = String(safeDate.getDate()).padStart(2, '0');
    const startDate = getGameStartDate(Number(gameData.year) || year);
    const dayIndex = Math.max(0, Math.round((safeDate - startDate) / 86400000));
    badge.textContent = `${year}-${month}-${day} [${dayIndex}]`;
}

function refreshVisiblePage() {
    try {
        updateDayBadge();

        if (document.querySelector('.portfolio-table') && typeof globalThis.refreshPortfolio === 'function') {
            void globalThis.refreshPortfolio();
        }

        if (document.querySelector('.deal-panel') && typeof globalThis.refreshTradeView === 'function') {
            globalThis.refreshTradeView();
        }
    } catch (error) {
        console.error('Ошибка обновления страницы после изменения дня:', error);
    }
}

function setPauseState(isPaused) {
    gameClock.isPaused = Boolean(isPaused);
    const pauseButtons = document.querySelectorAll('[data-game-pause-toggle]');
    pauseButtons.forEach((button) => {
        button.textContent = gameClock.isPaused ? 'Продолжить' : 'Пауза';
        button.setAttribute('aria-pressed', String(gameClock.isPaused));
    });
}

function togglePauseState() {
    setPauseState(!gameClock.isPaused);
}

async function advanceGameDay() {
    if (!gameData || gameClock.isPaused) return;

    const playerName = getCurrentGameId();
    gameData.date = normalizeDateValue(gameData.date, Number(gameData.year) || 2007);
    gameEngine.nextDay(gameData);

    await storage.saveGame(playerName, gameData);
    refreshVisiblePage();

    try {
        // если наступил первый день следующего года — показываем экран результатов
        const safeDate = normalizeDateValue(gameData.date, Number(gameData.year));
        const startYear = Number(gameData.year);
        if (safeDate.getFullYear() === startYear + 1 && safeDate.getMonth() === 8 && safeDate.getDate() === 1) {
            try {
                showYearResults();
                setPauseState(true);
            } catch (e) {
                console.error('Ошибка при показе годовых результатов:', e);
            }
        }
    } catch (e) {
        console.error('advanceGameDay: проверка окончания года не удалась', e);
    }

    // Если появилось ожидающее событие — покажем экран события
    try {
        if (gameData && gameData.pendingEvent) {
            showPendingEvent();
        }
    } catch (e) {
        console.error('Не удалось показать событие после хода:', e);
    }
}

function startGameClock() {
    if (gameClock.timerId) return;

    gameClock.timerId = globalThis.setInterval(() => {
        if (!gameClock.isPaused) {
            void advanceGameDay();
        }
    }, gameClock.intervalMs);
}

function stopGameClock() {
    if (gameClock.timerId) {
        globalThis.clearInterval(gameClock.timerId);
        gameClock.timerId = null;
    }
}

function createDefaultSelectedTickers() {
    return {
        bonds: [],
        stocks: [],
        fundTickers: [],
        usdTicker: 'USD',
        goldTicker: 'GLDRUB',
        bankTicker: 'BANK'
    };
}

function getCurrentGameId() {
    try {
      return localStorage.getItem('copilka-player-name');
    } catch (error) {
      throw new Error('Не удалось загрузить имя игрока из localStorage: ' + error.message);
    }
}

function normalizeDateValue(value, fallbackYear = 2007) {
    const temp = value instanceof Date ? new Date(value) : new Date(String(value));
    if (Number.isNaN(temp.getTime())) {
        return getGameStartDate(Number(fallbackYear) || 2007);
    }
    return temp;
}

function cloneGameData(data) {
    if (data === null || data === undefined) return data;
    if (data instanceof Date) return new Date(data.getTime());
    if (Array.isArray(data)) return data.map((item) => cloneGameData(item));
    if (typeof data !== 'object') return data;

    const seen = new WeakMap();
    const walk = (value) => {
        if (value === null || value === undefined) return value;
        if (value instanceof Date) return new Date(value.getTime());
        if (Array.isArray(value)) {
            const list = value.map((item) => walk(item));
            seen.set(value, list);
            return list;
        }
        if (typeof value === 'object') {
            if (seen.has(value)) return seen.get(value);
            const copy = {};
            seen.set(value, copy);
            Object.entries(value).forEach(([key, item]) => {
                copy[key] = walk(item);
            });
            return copy;
        }
        return value;
    };

    return walk(data);
}

function normalizeLoadedGameState(data) {
    const fallbackYear = Number((data && data.year) || 2007);
    const baseState = {
        portfolio: {
            cash: 10000,
            assets: {},
            assetValues: {},
            bankBalance: 0
        },
        date: getGameStartDate(fallbackYear),
        history: [],
        monthlyEvents: {},
        pendingEvent: null,
        year: String(fallbackYear)
    };

    const source = data && typeof data === 'object' ? data : {};
    const portfolio = {
        ...baseState.portfolio,
        ...(source.portfolio || {})
    };

    portfolio.cash = Number(portfolio.cash) || 0;
    portfolio.bankBalance = Number(portfolio.bankBalance) || 0;
    portfolio.assets = {};
    for (const [ticker, quantity] of Object.entries(source.portfolio?.assets || {})) {
        const amount = Number(quantity) || 0;
        if (Number.isFinite(amount) && amount > 0) {
            portfolio.assets[ticker] = amount;
        }
    }

    portfolio.assetValues = {};
    for (const [ticker, value] of Object.entries(source.portfolio?.assetValues || {})) {
        const quantity = Number(value?.quantity) || 0;
        const price = Number(value?.price) || 0;
        const total = Number(value?.value) || 0;
        portfolio.assetValues[ticker] = {
            quantity: Number.isFinite(quantity) ? quantity : 0,
            price: Number.isFinite(price) ? price : 0,
            value: Number.isFinite(total) ? total : 0
        };
    }

    const safeDate = normalizeDateValue(source.date || baseState.date, fallbackYear);
    const normalized = {
        ...baseState,
        ...source,
        portfolio,
        date: safeDate,
        year: String(Number(source.year) || safeDate.getFullYear() || fallbackYear)
    };

    if (normalized.histories && Array.isArray(normalized.histories)) {
        normalized.history = normalized.histories;
    }

    normalized.portfolio.cash = Number(normalized.portfolio.cash) || 0;
    normalized.portfolio.bankBalance = Number(normalized.portfolio.bankBalance) || 0;
    normalized.date = normalizeDateValue(normalized.date, Number(normalized.year) || fallbackYear);

    return normalized;
}

// Compute portfolio snapshot at given date (using current prices when available)
function computePortfolioSnapshot(date) {
    const safeDate = normalizeDateValue(date || gameData.date, Number(gameData.year) || 2007);
    const portfolio = cloneGameData(gameData.portfolio || {});
    const cash = Number(portfolio.cash) || 0;
    const bank = Number(portfolio.bankBalance) || 0;
    const assets = {};
    let assetsTotal = 0;

    const tickers = Object.keys(portfolio.assets || {});
    for (const ticker of tickers) {
        const quantity = Number(portfolio.assets[ticker] || 0) || 0;
        let price = 0;
        try {
            price = (prices && typeof prices.getPrice === 'function') ? Number(prices.getPrice(ticker, safeDate) || 0) : 0;
        } catch (e) {
            price = Number(portfolio.assetValues?.[ticker]?.price || 0);
        }
        const value = Number(quantity * price) || 0;
        assets[ticker] = { quantity, price, value };
        assetsTotal += value;
    }

    const total = cash + bank + assetsTotal;
    return { date: safeDate, cash, bank, assets, assetsTotal, total };
}

function showYearResults() {
    // compute initial and final snapshots
    const finalSnapshot = computePortfolioSnapshot(gameData.date);
    const initialSnapshot = gameData._initialSnapshot || computePortfolioSnapshot(getGameStartDate(Number(gameData.year) || 2007));

    const selected = gameData.selectedTickers || createDefaultSelectedTickers();
    const categories = {
        account: finalSnapshot.cash + finalSnapshot.bank,
        bonds: 0,
        corporate: 0,
        vdo: 0,
        stocks: 0,
        currency: 0,
        pif: 0,
        gold: 0,
        other: 0
    };

    const usdTicker = selected.usdTicker || 'USD';
    const goldTicker = selected.goldTicker || 'GLDRUB';
    const bondTickers = Array.isArray(selected.bonds) ? selected.bonds : [];
    const stockTickers = Array.isArray(selected.stocks) ? selected.stocks : [];
    const fundTickers = Array.isArray(selected.fundTickers) ? selected.fundTickers : [];

    for (const [ticker, info] of Object.entries(finalSnapshot.assets || {})) {
        const value = Number(info.value) || 0;
        if (bondTickers.includes(ticker)) {
            categories.bonds += value;
        } else if (stockTickers.includes(ticker)) {
            categories.stocks += value;
        } else if (fundTickers.includes(ticker)) {
            categories.pif += value;
        } else if (ticker === usdTicker) {
            categories.currency += value;
        } else if (ticker === goldTicker) {
            categories.gold += value;
        } else {
            categories.other += value;
        }
    }

    const total = Number(finalSnapshot.total) || 0;
    const startTotal = Number(initialSnapshot.total) || 0;
    const growth = total - startTotal;
    const growthPct = startTotal > 0 ? (growth / startTotal) * 100 : 0;

    // render capital card
    const resultsRoot = document.getElementById('results');
    if (!resultsRoot) return;

    const amt = resultsRoot.querySelector('.results-capital-card .amount');
    const growthEl = resultsRoot.querySelector('.results-capital-card .growth');
    const pctEl = resultsRoot.querySelector('.results-capital-card .percent');
    const startEl = resultsRoot.querySelector('.results-capital-card .start');
    const growthAmountEl = resultsRoot.querySelector('.results-capital-card .growth-amount');

    const fmt = (v) => `${Math.round(Number(v || 0)).toLocaleString('ru-RU')} ₽`;
    const fmtPct = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}%`;

    if (amt) amt.textContent = fmt(total);
    if (growthEl) growthEl.textContent = `${growth >= 0 ? '+' : ''}${Math.round(growth).toLocaleString('ru-RU')} ₽`;
    if (pctEl) pctEl.textContent = fmtPct(growthPct);
    if (startEl) startEl.textContent = `Ты начал(а) с ${fmt(startTotal)}`;
    if (growthAmountEl) growthAmountEl.textContent = `${Math.round(growth).toLocaleString('ru-RU')} ₽`;

    // stats-grid values
    const statValues = resultsRoot.querySelectorAll('.stats-grid .stat-card .value');
    if (statValues && statValues.length >= 4) {
        statValues[0].textContent = fmt(startTotal);
        statValues[1].textContent = fmt(total);
        statValues[2].textContent = `${growth >= 0 ? '+' : ''}${Math.round(growth).toLocaleString('ru-RU')} ₽`;
        statValues[3].textContent = fmtPct(growthPct).replace('+', '+');
    }

    // structure legend — find legend items and populate by order
    const legendItems = resultsRoot.querySelectorAll('.structure-legend .legend-item');
    const order = ['account', 'bonds', 'corporate', 'vdo', 'stocks', 'currency', 'pif', 'gold'];
    order.forEach((key, idx) => {
        const node = legendItems[idx];
        if (!node) return;
        const valueNode = node.querySelector('.value');
        const nameNode = node.querySelector('.name');
        const val = Number(categories[key] || 0);
        const pct = total > 0 ? Math.round((val / total) * 100) : 0;
        if (valueNode) valueNode.textContent = `${pct}%`;
        if (nameNode) {
            // leave existing name
        }
    });

    // update bar chart visualization to reflect real portfolio structure (widths that sum to 100%)
    try {
        const bars = Array.from(resultsRoot.querySelectorAll('.bars .bar'));
        // compute raw percentages
        const raw = order.map((key) => (total > 0 ? (Number(categories[key] || 0) / total) * 100 : 0));
        // rounded percentages and adjust rounding error by adding remainder to the largest slice
        const rounded = raw.map((r) => Math.round(r));
        const sumRounded = rounded.reduce((s, v) => s + v, 0);
        const diff = 100 - sumRounded;
        if (diff !== 0) {
            // find index of max raw value
            let maxIdx = 0;
            for (let i = 1; i < raw.length; i++) {
                if ((raw[i] || 0) > (raw[maxIdx] || 0)) maxIdx = i;
            }
            rounded[maxIdx] = (rounded[maxIdx] || 0) + diff;
        }

        const barInfos = [];
        order.forEach((key, idx) => {
            const pct = Math.max(0, rounded[idx] || 0);
            const bar = bars[idx];
            if (!bar) return;
            // Ensure inline width is honored (disable flex growth)
            bar.style.flex = '0 0 auto';
            // Set width so bars grow horizontally and collectively occupy 100%
            bar.style.width = `${pct}%`;
            bar.style.minWidth = '0';
            bar.style.height = '';
            bar.style.transition = 'width 0.3s';
            // Provide accessible label and tooltip
            bar.setAttribute('role', 'img');
            bar.setAttribute('aria-label', `${pct}% — ${Math.round(Number(categories[key] || 0)).toLocaleString('ru-RU')} ₽`);
            bar.title = `${pct}% — ${Math.round(Number(categories[key] || 0)).toLocaleString('ru-RU')} ₽`;

            // label inside bar if wide enough
            let label = bar.querySelector('.bar-label');
            if (pct >= 6) {
                if (!label) {
                    label = document.createElement('span');
                    label.className = 'bar-label';
                    bar.appendChild(label);
                }
                label.textContent = `${pct}%`;
                label.style.display = '';
            } else if (label) {
                label.style.display = 'none';
            }

            // reset radius — we'll apply correct rounding after loop
            bar.style.borderRadius = '0';

            barInfos.push({ node: bar, key, pct, value: Number(categories[key] || 0) });
        });

        // apply rounded corners: first visible bar gets left rounding, last visible — right rounding
        try {
            const visible = barInfos.filter((b) => (b.pct || 0) > 0);
            if (visible.length === 1) {
                const only = visible[0].node;
                only.style.borderRadius = '8px';
            } else if (visible.length > 1) {
                const first = visible[0].node;
                const last = visible[visible.length - 1].node;
                if (first) first.style.borderRadius = '4px 0 0 4px';
                if (last) last.style.borderRadius = '0 4px 4px 0';
            } else {
                // no visible bars: restore default first/last child rounding
                const first = bars[0];
                const last = bars[bars.length - 1];
                if (first) first.style.borderRadius = '4px 0 0 4px';
                if (last) last.style.borderRadius = '0 4px 4px 0';
            }
        } catch (e) {
            // non-fatal
        }

        // sort legend items by pct descending so legend order matches visual importance
        try {
            const legend = resultsRoot.querySelector('.structure-legend');
            if (legend) {
                const items = Array.from(legend.querySelectorAll('.legend-item'));
                const itemInfos = items.map((node, idx) => ({ node, key: order[idx], pct: Math.max(0, rounded[idx] || 0) }));
                itemInfos.sort((a, b) => b.pct - a.pct);
                // re-append in sorted order
                itemInfos.forEach((it) => legend.appendChild(it.node));
            }
        } catch (e) {
            // non-fatal
        }
    } catch (e) {
        console.warn('Не удалось обновить бар-чарт структуры активов:', e);
    }

    // earnings — show profit per category
    const earningRows = resultsRoot.querySelectorAll('.earning-grid .earning-row');
    earningRows.forEach((row) => {
        const name = row.querySelector('.name')?.textContent?.trim();
        const amountNode = row.querySelector('.amount');
        if (!name || !amountNode) return;
        let profit = 0;
        // map name to category key
        const map = {
            'Накопительный счёт': 'account',
            'ОФЗ': 'bonds',
            'Корп. облигации': 'corporate',
            'ВДО': 'vdo',
            'Акции': 'stocks',
            'Иностранная валюта': 'currency',
            'ПИФ': 'pif',
            'Золото': 'gold'
        };
        const key = map[name] || null;
        if (key) {
            // compute initial and final for that category
            const initialVal = computeCategoryValue(initialSnapshot, key, selected);
            const finalVal = computeCategoryValue(finalSnapshot, key, selected);
            profit = finalVal - initialVal;
        }
        amountNode.textContent = `${profit >= 0 ? '+' : ''}${Math.round(profit).toLocaleString('ru-RU')} ₽`;
        amountNode.classList.toggle('positive', profit >= 0);
        amountNode.classList.toggle('negative', profit < 0);
    });

    // finally, open results page
    try {
        if (typeof window.showPage === 'function') window.showPage('results');
    } catch (e) {
        console.error('Не удалось открыть страницу результатов', e);
    }
}

function computeCategoryValue(snapshot, key, selected) {
    if (!snapshot) return 0;
    if (key === 'account') return Number(snapshot.cash || 0) + Number(snapshot.bank || 0);
    const usdTicker = selected?.usdTicker || 'USD';
    const goldTicker = selected?.goldTicker || 'GLDRUB';
    const bondTickers = Array.isArray(selected?.bonds) ? selected.bonds : [];
    const stockTickers = Array.isArray(selected?.stocks) ? selected.stocks : [];
    const fundTickers = Array.isArray(selected?.fundTickers) ? selected.fundTickers : [];

    let sum = 0;
    for (const [ticker, info] of Object.entries(snapshot.assets || {})) {
        const val = Number(info.value) || 0;
        if (key === 'bonds' && bondTickers.includes(ticker)) sum += val;
        else if (key === 'stocks' && stockTickers.includes(ticker)) sum += val;
        else if (key === 'pif' && fundTickers.includes(ticker)) sum += val;
        else if (key === 'currency' && ticker === usdTicker) sum += val;
        else if (key === 'gold' && ticker === goldTicker) sum += val;
        else if (key === 'other') sum += val;
    }
    return sum;
}

gameEngine = new GameEngine(storage, prices);

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
            return !/BANK|USD|GLDRUB/i.test(ticker)
                && !/BANK|USD|GLDRUB/i.test(name)
                && (ticker.length > 8 || /FUND|ФОНД|EQ|JR|RU000/i.test(name) || /FUND|ФОНД|EQ|JR|RU000/i.test(ticker));
        })
        .map((row) => row.Ticker)
        .slice(0, 2);

    const stockCandidates = stockPool.map((row) => row.Ticker).filter(Boolean);
    const stockCount = Math.min(3, stockCandidates.length);
    const stocks = shuffleArray(stockCandidates).slice(0, stockCount);

    const bondCandidates = rows.slice(0, 5).map((row) => row.Ticker).filter(Boolean);
    const first = bondCandidates[0];
    const secondOrThird = bondCandidates[Math.random() < 0.5 ? 1 : 2];
    const fourthOrFifth = bondCandidates[Math.random() < 0.5 ? 3 : 4];

    const goldTicker = trailingSpecialRows.find((row) => /GLDRUB/i.test(row.Ticker) || /GLDRUB/i.test(row.Name))?.Ticker;

    return {
        bonds: [first, secondOrThird, fourthOrFifth].filter(Boolean),
        stocks,
        usdTicker,
        goldTicker,
        fundTickers,
        bankTicker
    };
}

async function ensureTickerSelection() {
    try {
        const csvMap = await loadTickersCsv();
        const years = Object.keys(csvMap);
        if (!years.length) {
            throw new Error('Нет доступных данных в tickers.csv');
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
        throw new Error(`Не удалось загрузить tickers.csv: ${err}`);
    }
}

async function loadGame() {
    const playerName = getCurrentGameId();
    const saved = await storage.loadGame(playerName);
    if (saved) {
        gameData = normalizeLoadedGameState(saved);
        if (gameData.year) {
            prices = await LocalPrices.create(String(gameData.year));
            gameEngine.prices = prices;
        }
    }
}

async function initializeGame() {
    // Пытаемся загрузить сохранённую игру
    await loadGame();

    if (!gameData.selectedTickers || !gameData.year) {
        await ensureTickerSelection();
    }

    if (!prices) {
        const year = gameData?.year;
        prices = await LocalPrices.create(String(year || 2007));
        gameEngine.prices = prices;
    }

    const safeYear = Number(gameData.year) || 2007;
    const startDate = getGameStartDate(safeYear);
    const normalizedDate = normalizeDateValue(gameData.date || startDate, safeYear);
    gameData.date = normalizedDate;
    gameData.year = String(safeYear);

    if (gameData.date.getFullYear() !== safeYear || gameData.date.getMonth() !== 7 || gameData.date.getDate() !== 1) {
        gameData.date = startDate;
    }

    startGameClock();
}
    // Ensure we have a snapshot of the starting portfolio to calculate yearly profit
    try {
        const safeYear = Number(gameData.year) || 2007;
        const startDate = getGameStartDate(safeYear);
        if (!gameData._initialSnapshot) {
            gameData._initialSnapshot = computePortfolioSnapshot(startDate);
        }
    } catch (e) {
        console.warn('Не удалось создать начальный снимок портфеля:', e);
    }

async function resetGame() {
    const playerName = getCurrentGameId();
    gameData = {
        portfolio: {
            cash: 10000,
            assets: {},
            assetValues: {},
            bankBalance: 0
        },
        date: getGameStartDate(2007),
        history: [],
        monthlyEvents: {},
        pendingEvent: null
    };
    await storage.saveGame(playerName, gameData);
    return gameData;
}

// Start a fresh game flow triggered by "Играть ещё" button.
async function startNewGame() {
    try {
        setPauseState(true);
        stopGameClock();
        const playerName = getCurrentGameId();

        // Reset in-memory state and persist without explicitly deleting previous storage key.
        await resetGame();

        // Clear any computed snapshots
        delete gameData._initialSnapshot;

        // Navigate to registration so player can enter a name (or re-use existing)
        if (typeof window.showPage === 'function') {
            window.showPage('registration');
        }
    } catch (e) {
        console.error('Не удалось корректно начать новую игру:', e);
    }
}

globalThis.game = {
    data: () => gameData,
    engine: gameEngine,
    getPrices: () => prices,
    getStorage: () => storage,
    initialize: initializeGame,
    reset: resetGame
};

async function bootstrapAppShell() {
    try {
        const pauseButtons = document.querySelectorAll('[data-game-pause-toggle]');
        pauseButtons.forEach((button) => {
            button.addEventListener('click', () => togglePauseState());
        });

        // Lightweight app-shell logic (safely runs on any page)
        const storageKey = 'copilka-player-name';

        function getPlayerName() {
            try {
                return localStorage.getItem(storageKey) || 'Игрок';
            } catch (error) {
                console.error('Не удалось загрузить имя игрока:', error);
                return 'Игрок';
            }
        }

        function setPlayerName(name) {
            try {
                localStorage.setItem(storageKey, name);
            } catch (error) {
                console.error('Не удалось сохранить имя игрока:', error);
            }
        }

        function syncProfileNames() {
            const playerName = getPlayerName();
            document.querySelectorAll('.nav-profile, .profile-btn').forEach((el) => {
                el.textContent = playerName;
            });
        }

        function bindRegistration() {
            const input = document.querySelector('.input-field');
            const button = document.querySelector('.btn-continue');
            if (!input || !button) return;

            input.value = getPlayerName();

            const submit = () => {
                const value = input.value.trim() || 'Игрок';
                setPlayerName(value);
                syncProfileNames();
                void resumeGameAfterContinue();
            };

            button.addEventListener('click', () => {
                void submit();
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    void submit();
                }
            });
        }


        syncProfileNames();
        bindRegistration();
    } catch (e) {
        console.error('bootstrapAppShell error', e);
    }
}

function bootstrapTrade() {
    try {
        // Use a presence check to run only on pages that have trade UI
        if (!document.querySelectorAll || !document.querySelector('.asset-card')) return;

        (function () {
            const assetCards = document.querySelectorAll('.asset-card');
            const toggleSwitch = document.getElementById('toggleSwitch');
            const buyOption = toggleSwitch ? toggleSwitch.querySelector('.option[data-value="buy"]') : null;
            const sellOption = toggleSwitch ? toggleSwitch.querySelector('.option[data-value="sell"]') : null;
            const selectedAssetName = document.getElementById('selectedAssetName');
            const quantityLabel = document.getElementById('quantityLabel');
            const unitLabel = document.getElementById('unitLabel');
            const quantityInput = document.getElementById('quantityInput');
            const totalAmount = document.getElementById('totalAmount');
            const buyBtn = document.getElementById('buyBtn');
            const sellBtn = document.getElementById('sellBtn');

            let currentAsset = 'account';
            let currentAction = 'buy';
            let currentBond = 0;
            let currentStock = 0;
            let currentPif = 0;

            const assetData = {
                account: { label: 'Накопительный счет', quantityLabel: 'Сумма к пополнению/снятию', price: -1, infoId: 'accountInfo' },
                bonds: { label: 'ОФЗ', quantityLabel: 'Количество', price: -1, infoId: 'bondsSelection' },
                pif: { label: 'ПИФ1', quantityLabel: 'Количество', price: -1, infoId: 'pifSelection' },
                stocks: { label: 'Акция1', quantityLabel: 'Количество', price: -1, infoId: 'stocksSelection' },
                currency: { label: 'USD', quantityLabel: 'Количество', price: -1, infoId: 'currencyInfo' },
                gold: { label: 'Золото', quantityLabel: 'Количество', price: -1, infoId: 'goldInfo' }
            };

            function safeNumber(value) {
                return Number.isFinite(Number(value)) ? Number(value) : 0;
            }

            function formatMoney(value) {
                return `${Math.round(safeNumber(value)).toLocaleString('ru-RU')} ₽`;
            }

            function resolveTickerByAsset() {
                const selected = gameData?.selectedTickers || createDefaultSelectedTickers();
                const others = Array.isArray(selected.others) ? selected.others : [];
                const fundTickers = Array.isArray(selected.fundTickers) ? selected.fundTickers : [];
                const usdTicker = selected.usdTicker || others.find((t) => /USD/i.test(String(t))) || 'USD';
                const goldTicker = selected.goldTicker || others.find((t) => /GLDRUB/i.test(String(t))) || 'GLDRUB';

                if (currentAsset === 'account') return selected.bankTicker || 'BANK';
                if (currentAsset === 'bonds') return (Array.isArray(selected.bonds) ? selected.bonds[currentBond] : undefined) || null;
                if (currentAsset === 'stocks') return (Array.isArray(selected.stocks) ? selected.stocks[currentStock] : undefined) || null;
                if (currentAsset === 'pif') return (Array.isArray(fundTickers) ? fundTickers[currentPif] : undefined) || null;
                if (currentAsset === 'currency') return usdTicker;
                if (currentAsset === 'gold') return goldTicker;
                throw new Error("Неизвестный актив: " + currentAsset);
            }

            function syncSelectedAssetNames() {
                const selected = gameData?.selectedTickers || createDefaultSelectedTickers();
                const prices = globalThis.game && typeof globalThis.game.getPrices === 'function' ? globalThis.game.getPrices() : null;

                const usdTicker = selected.usdTicker;
                const goldTicker = selected.goldTicker;

                const fundList = Array.isArray(selected.fundTickers) ? selected.fundTickers : createDefaultSelectedTickers().fundTickers;
                const bondList = Array.isArray(selected.bonds) ? selected.bonds : createDefaultSelectedTickers().bonds;
                const stockList = Array.isArray(selected.stocks) ? selected.stocks : createDefaultSelectedTickers().stocks;

                if (bondList && bondList.length) {
                    currentBond = Math.min(currentBond, bondList.length - 1);
                    const bondTicker = bondList[currentBond];
                    const currentDate = gameData && gameData.date ? gameData.date : new Date(Number(gameData?.year || 2007), 8, 1);
                    assetData.bonds.label = bondTicker || '—';
                    assetData.bonds.price = (prices && typeof prices.getPrice === 'function' && bondTicker)
                        ? Number(prices.getPrice(bondTicker, currentDate))
                        : -1;
                } else {
                    assetData.bonds.label = '—';
                    assetData.bonds.price = -1;
                }

                if (stockList && stockList.length) {
                    currentStock = Math.min(currentStock, stockList.length - 1);
                    const stockTicker = stockList[currentStock];
                    const currentDate = gameData && gameData.date ? gameData.date : new Date(Number(gameData?.year || 2007), 8, 1);
                    assetData.stocks.label = stockTicker || '—';
                    assetData.stocks.price = (prices && typeof prices.getPrice === 'function' && stockTicker)
                        ? Number(prices.getPrice(stockTicker, currentDate) || -1)
                        : -1;
                } else {
                    assetData.stocks.label = '—';
                    assetData.stocks.price = -1;
                }

                if (fundList && fundList.length) {
                    currentPif = Math.min(currentPif, fundList.length - 1);
                    const pifTicker = fundList[currentPif];
                    const currentDate = gameData && gameData.date ? gameData.date : new Date(Number(gameData?.year || 2007), 8, 1);
                    assetData.pif.label = pifTicker || '—';
                    assetData.pif.price = (prices && typeof prices.getPrice === 'function' && pifTicker)
                        ? Number(prices.getPrice(pifTicker, currentDate))
                        : -1;
                } else {
                    assetData.pif.label = '—';
                    assetData.pif.price = -1;
                }

                const currentDate = gameData && gameData.date ? gameData.date : new Date(Number(gameData?.year || 2007), 8, 1);
                const bankRateValue = (prices && typeof prices.getPrice === 'function') ? Number(prices.getPrice('BANK', currentDate) || 0) : 0;

                assetData.currency.price = (prices && typeof prices.getPrice === 'function' && usdTicker)
                    ? Number(prices.getPrice(usdTicker, currentDate) || -1)
                    : -1;
                assetData.gold.price = (prices && typeof prices.getPrice === 'function' && goldTicker)
                    ? Number(prices.getPrice(goldTicker, currentDate) || -1)
                    : -1;

                const accountInfoValue = document.querySelector('#accountInfo .value');
                if (accountInfoValue) {
                    accountInfoValue.textContent = Number.isFinite(bankRateValue) && bankRateValue > 0
                        ? `${(bankRateValue).toFixed(1).replace('.', ',')}% годовых`
                        : '10% годовых';
                }

                // --- update DOM price labels in the HTML ---
                function fmtPrice(value, kind) {
                    if (!Number.isFinite(Number(value)) || Number(value) < 0) return '—';
                    if (kind === 'stock') return `${Math.round(Number(value)).toLocaleString('ru-RU')} ₽ / акция`;
                    if (kind === 'pif') return `${Math.round(Number(value)).toLocaleString('ru-RU')} руб. за пай`;
                    if (kind === 'currency') return `${Number(value).toFixed(2).replace('.', ',')} руб. / 1 USD`;
                    return `${Math.round(Number(value)).toLocaleString('ru-RU')} руб.`;
                }
                // bonds selection items
                const bondElems = Array.from(document.querySelectorAll('#bondsSelection .selection-item'));
                bondElems.forEach((el, idx) => {
                    const priceSpan = el.querySelector('.price');
                    const priceVal = (Array.isArray(bondList) && bondList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(bondList[idx], gameData.date) || -1) : -1) : -1;
                    if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'bond');
                });

                const stockElems = Array.from(document.querySelectorAll('#stocksSelection .selection-item'));
                stockElems.forEach((el, idx) => {
                    const priceSpan = el.querySelector('.price');
                    const priceVal = (Array.isArray(stockList) && stockList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(stockList[idx], gameData.date) || -1) : -1) : -1;
                    if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'stock');
                });

                const pifElems = Array.from(document.querySelectorAll('#pifSelection .selection-item'));
                pifElems.forEach((el, idx) => {
                    const priceSpan = el.querySelector('.price');
                    const priceVal = (Array.isArray(fundList) && fundList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(fundList[idx], gameData.date) || -1) : -1) : -1;
                    if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'pif');
                });

                const currencyPriceSpan = document.querySelector('#currencyInfo .value');
                if (currencyPriceSpan) currencyPriceSpan.textContent = fmtPrice(assetData.currency.price, 'currency');
                const goldPriceSpan = document.querySelector('#goldInfo .value');
                if (goldPriceSpan) goldPriceSpan.textContent = fmtPrice(assetData.gold.price, 'gold');
            }

            function updateTotal() {
                if (!quantityInput || !totalAmount) return;
                const value = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
                const total = currentAsset === 'account' ? value : value * (assetData[currentAsset]?.price || 0);
                totalAmount.textContent = `${total.toLocaleString('ru-RU')} ₽`;
            }

            function updateUI() {
                syncSelectedAssetNames();

                assetCards.forEach((card) => {
                    const asset = card.dataset.asset;
                    if (asset === currentAsset) {
                        card.classList.add('active');
                        card.classList.remove('inactive');
                        const name = card.querySelector('.name');
                        const desc = card.querySelector('.desc');
                        const arrow = card.querySelector('.arrow');
                        if (name) name.classList.remove('faded');
                        if (desc) desc.classList.remove('faded');
                        if (arrow) arrow.classList.remove('faded');
                    } else {
                        card.classList.remove('active');
                        card.classList.add('inactive');
                        const name = card.querySelector('.name');
                        const desc = card.querySelector('.desc');
                        const arrow = card.querySelector('.arrow');
                        if (name) name.classList.add('faded');
                        if (desc) desc.classList.add('faded');
                        if (arrow) arrow.classList.add('faded');
                    }
                });

                document.querySelectorAll('.selection-card, .asset-info-card').forEach((el) => {
                    el.classList.remove('visible');
                });

                const data = assetData[currentAsset] || assetData.account;
                const infoEl = document.getElementById(data.infoId);
                if (infoEl) infoEl.classList.add('visible');

                if (selectedAssetName) selectedAssetName.textContent = data.label;
                if (quantityLabel) quantityLabel.textContent = data.quantityLabel;
                if (unitLabel) unitLabel.textContent = data.unit;
                if (buyBtn) buyBtn.textContent = currentAction === 'buy' ? 'Купить' : 'Продать';
                if (sellBtn) sellBtn.textContent = currentAction === 'buy' ? 'Продать' : 'Купить';

                updateTotal();
                syncTradePanel();
            }

            function selectAsset(asset) {
                if (asset === currentAsset) return;
                currentAsset = asset;
                updateUI();
            }

            function syncTradePanel() {
                const available = document.querySelector('.deal-available');
                if (available) {
                    const cash = safeNumber(gameData?.portfolio?.cash);
                    const bank = safeNumber(gameData?.portfolio?.bankAccount?.balance);
                    available.textContent = `Доступно: ${formatMoney(cash + bank)}`;
                }

                const amount = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
                const price = currentAsset === 'account' ? 1 : (assetData[currentAsset]?.price || 0);
                if (totalAmount) totalAmount.textContent = `${(amount * price).toLocaleString('ru-RU')} ₽`;
            }

            async function tryTrade(action) {
                console.log('Попытка сделки:', action, 'для актива', currentAsset);
                const quantity = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
                if (!quantity || quantity <= 0) {
                    alert('Введите корректное количество');
                    return;
                }

                const engine = globalThis.game && globalThis.game.engine ? globalThis.game.engine : null;

                if (!engine) {
                    alert('Игра ещё не инициализирована');
                    return;
                }

                try {
                    const nextState = cloneGameData(gameData);

                    let result;
                    if (currentAsset === 'account') {
                        result = action === 'buy'
                            ? engine.openBank(nextState, quantity)
                            : engine.withdrawBank(nextState, quantity);
                    } else {
                        const ticker = resolveTickerByAsset();
                        if (!ticker) {
                            alert('Тикер не выбран для текущего актива');
                            return;
                        }
                        console.log('Выполняем сделку для тикера:', ticker, 'количество:', quantity, 'действие:', action);
                        result = action === 'buy' ? engine.buyAsset(nextState, ticker, quantity) : engine.sellAsset(nextState, ticker, quantity);
                    }

                    gameData = result;
                    globalThis.game.data = () => gameData;

                    const playerName = getCurrentGameId();
                    await storage.saveGame(playerName, gameData);
                    refreshVisiblePage();
                    updateUI();
                } catch (error) {
                    alert(error.message || 'Не удалось выполнить сделку');
                }
            }

            if (assetCards.length) {
                assetCards.forEach((card) => {
                    card.addEventListener('click', () => {
                        selectAsset(card.dataset.asset);
                    });
                });
            }

            document.querySelectorAll('#bondsSelection .selection-item').forEach((item) => {
                item.addEventListener('click', () => {
                    document.querySelectorAll('#bondsSelection .selection-item').forEach((el) => {
                        el.classList.remove('active');
                        el.classList.add('inactive');
                    });
                    item.classList.add('active');
                    item.classList.remove('inactive');
                    currentBond = [...document.querySelectorAll('#bondsSelection .selection-item')].indexOf(item);
                    updateUI();
                });
            });

            document.querySelectorAll('#stocksSelection .selection-item').forEach((item) => {
                item.addEventListener('click', () => {
                    document.querySelectorAll('#stocksSelection .selection-item').forEach((el) => {
                        el.classList.remove('active');
                        el.classList.add('inactive');
                    });
                    item.classList.add('active');
                    item.classList.remove('inactive');
                    currentStock = [...document.querySelectorAll('#stocksSelection .selection-item')].indexOf(item);
                    updateUI();
                });
            });

            document.querySelectorAll('#pifSelection .selection-item').forEach((item) => {
                item.addEventListener('click', () => {
                    document.querySelectorAll('#pifSelection .selection-item').forEach((el) => {
                        el.classList.remove('active');
                        el.classList.add('inactive');
                    });
                    item.classList.add('active');
                    item.classList.remove('inactive');
                    currentPif = [...document.querySelectorAll('#pifSelection .selection-item')].indexOf(item);
                    updateUI();
                });
            });

            if (toggleSwitch) {
                toggleSwitch.addEventListener('click', (event) => {
                    const option = event.target.closest('.option');
                    if (!option || option.classList.contains('active')) return;

                    if (buyOption) {
                        buyOption.classList.toggle('active');
                        buyOption.classList.toggle('inactive');
                    }
                    if (sellOption) {
                        sellOption.classList.toggle('active');
                        sellOption.classList.toggle('inactive');
                    }

                    currentAction = option.dataset.value;
                    updateUI();
                });
            }

            if (quantityInput) {
                quantityInput.addEventListener('input', () => {
                    updateTotal();
                    syncTradePanel();
                });
            }

            if (buyBtn) {
                buyBtn.addEventListener('click', () => {
                    void tryTrade(currentAction === 'buy' ? 'buy' : 'sell');
                });
            }

            if (sellBtn) {
                sellBtn.addEventListener('click', () => {
                    void tryTrade(currentAction === 'buy' ? 'sell' : 'buy');
                });
            }

            if (quantityInput) {
                quantityInput.value = '1000';
            }

            globalThis.refreshTradeView = function refreshTradeView() {
                try {
                    syncSelectedAssetNames();
                    updateUI();
                } catch (error) {
                    console.error('Ошибка обновления торговли:', error);
                }
            };

            updateUI();
        })();
    } catch (e) {
        console.error('bootstrapTrade error', e);
    }
}

function bootstrapPortfolio() {
    try {
        if (!document.querySelector || !document.querySelector('.portfolio-table')) return;

        (function () {
            const debugPortfolio = (...args) => console.info('[portfolio]', ...args);

            function formatMoney(value) {
                return `${Math.round(Number(value || 0)).toLocaleString('ru-RU')} ₽`;
            }

            function collectAssetValue(portfolio, tickerList) {
                const assetValues = portfolio.assetValues || {};
                let total = 0;
                tickerList.forEach((ticker) => {
                    total += Number(assetValues[ticker]?.value || 0);
                });
                return total;
            }

            async function renderPortfolio() {
                const portfolio = gameData.portfolio;
                const bankBalance = Number(portfolio.bankBalance);
                const cash = Number(portfolio.cash);
                const total = gameEngine.getTotalValue(portfolio);

                debugPortfolio('render data', { portfolio, cash, bankBalance, total, date: gameData.date, selectedTickers: gameData.selectedTickers });

                updateDayBadge();

                const summaryValues = document.querySelectorAll('.stats-row .stat-card .value');
                if (summaryValues.length >= 2) {
                    summaryValues[0].textContent = formatMoney(total);
                    summaryValues[1].textContent = formatMoney(cash);
                }

                const rows = Array.from(document.querySelectorAll('.asset-row'));
                let values = [];
                if (gameData.selectedTickers) {
                    values = [
                        { label: 'Накопительный счёт', value: bankBalance, color: 'fill-green' },
                        { label: 'ОФЗ', value: collectAssetValue(portfolio, [gameData.selectedTickers.bonds[0]]) || 0, color: 'fill-dark' },
                        { label: 'Корп. облигации', value: collectAssetValue(portfolio, [gameData.selectedTickers.bonds[1]]) || 0, color: 'fill-mint' },
                        { label: 'ВДО', value: collectAssetValue(portfolio, [gameData.selectedTickers.bonds[2]]) || 0, color: 'fill-gold' },
                        { label: 'ПИФ', value: collectAssetValue(portfolio, gameData.selectedTickers.fundTickers) || 0, color: 'fill-sand' },
                        { label: 'Акции', value: collectAssetValue(portfolio, gameData.selectedTickers.stocks) || 0, color: 'fill-blue' },
                        { label: 'Иностранная валюта', value: collectAssetValue(portfolio, [gameData.selectedTickers.usdTicker]) || 0, color: 'fill-purple' },
                        { label: 'Золото', value: collectAssetValue(portfolio, [gameData.selectedTickers.goldTicker]) || 0, color: 'fill-teal' }
                    ];
                } else {
                    values = [
                        { label: 'Накопительный счёт', value: bankBalance, color: 'fill-green' },
                        { label: 'ОФЗ', value: 0, color: 'fill-dark' },
                        { label: 'Корп. облигации', value: 0, color: 'fill-mint' },
                        { label: 'ВДО', value: 0, color: 'fill-gold' },
                        { label: 'ПИФ', value: 0, color: 'fill-sand' },
                        { label: 'Акции', value: 0, color: 'fill-blue' },
                        { label: 'Иностранная валюта', value: 0, color: 'fill-purple' },
                        { label: 'Золото', value: 0, color: 'fill-teal' }
                    ];
                }
                

                rows.forEach((row, index) => {
                    const item = values[index];
                    const title = row.querySelector('.asset-name');
                    const value = row.querySelector('.asset-value');
                    const fill = row.querySelector('.fill');
                    if (title) {
                        title.textContent = item.label;
                        title.classList.toggle('inactive', (item.value || 0) <= 0);
                    }
                    if (value) {
                        value.textContent = formatMoney(item.value);
                        value.classList.toggle('inactive', (item.value || 0) <= 0);
                    }
                    if (fill) {
                        const width = total > 0 ? Math.max(0, Math.min(100, (item.value / total) * 100)) : 0;
                        fill.style.width = `${width}%`;
                        fill.className = `fill ${item.color}`;
                    }
                });
            }

            function bootstrapPortfolioInner() {
                debugPortfolio('portfolio bootstrap start', { readyState: document.readyState, hasGame: !!globalThis.game });
                (async () => {
                    try {
                        await renderPortfolio();
                    } catch (error) {
                        console.error('Ошибка при рендеринге портфеля: ', error);
                    }
                })();
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', bootstrapPortfolioInner, { once: true });
            } else {
                bootstrapPortfolioInner();
            }

            globalThis.refreshPortfolio = async function refreshPortfolioPage() {
                if (!document.querySelector('.portfolio-table')) return;
                await renderPortfolio();
            };
        })();
    } catch (e) {
        console.error('bootstrapPortfolio error', e);
    }
}

function bootstrapTeaching() {
    try {
        if (!document.querySelector || !document.querySelectorAll('.asset-content')) return;

        (function () {
            const assets = [
                'account', 'ofz', 'corp', 'vdo',
                'stocks', 'currency', 'pif', 'gold'
            ];
            let currentIndex = 0;

            const titles = [
                'Накопительный счёт в банке',
                'ОФЗ — облигации федерального займа',
                'Корпоративные облигации',
                'ВДО — высокодоходные облигации',
                'Акции',
                'Иностранная валюта',
                'ПИФ — паевые инвестиционные фонды',
                'Золото'
            ];

            const subtitles = [
                'Разберём инструмент за 60 секунд',
                'Ты даёшь государству деньги в долг',
                'Компания занимает деньги у инвесторов',
                'Высокий купон не бывает бесплатным',
                'Часть компании в твоем портфеле',
                'Иностранные деньги и инструменты',
                'Много инвесторов — один фонд',
                'Золото — инвестиционный товар'
            ];

            const exampleTitles = [
                'Как считается доход за день',
                'Доход по ОФЗ за полгода + влияние ставки ЦБ',
                'Доход по облигации Компании А',
                'Доход по облигации Компании В',
                'Финансовый результат по акции Компании С',
                'Результат по дирхаму и евро',
                'Пример для ПИФ (скоро)',
                'Пример для Золота (скоро)'
            ];

            const exampleDescs = [
                'Например, если на начало дня на счете было 10000 рублей, потом на него с кошелька была переведена зарплата 10000 рублей, и в этот же день списаны 17000 рублей на покупку облигаций, то минимальный остаток в этот день на счете – 3000 рублей. За этот день процентный доход будет рассчитан: <code>(3000×1×10)/(365×100) = 0,82 рубля.</code>',
                'Время владения ОФЗ номиналом 1000 рублей — полгода (182 дня). Был выплачен купон 7% годовых, бумага выросла с 830 до 850 рублей. Общий доход: <code>(850–830)+(1000×182×7)/(365×100) = 20 + 34,90 = 54,90 ₽</code>.<br><br><strong>Как зависит цена от ставки ЦБ?</strong> После покупки ОФЗ по 900 ₽ рост ключевой ставки может снизить цену до 850 ₽ — потеря 50 ₽ с каждой бумаги. В реальных расчётах учтите налоги и комиссии.',
                'Облигация Компании А номиналом 1000 ₽, купон 12% годовых выплачивается ежемесячно. Владение 8 месяцев (≈9 выплат), цена упала с 930 до 920 ₽. Доход: <code>(920–930)+[(1000×31×12)/(365×100)]×9 = –10 + 91,73 = 81,73 ₽</code>. Налоги и комиссии не учтены.',
                'Облигация Компании В номинал 1000 ₽, купон 25% годовых выплачивается раз в квартал. Владение 3 месяца (91 день), цена выросла с 960 до 975 ₽. Доход: <code>(975–960)+(1000×91×25)/(365×100) = 15 + 62,33 = 77,33 ₽</code>. Налоги и комиссии не учтены.',
                'Акция Компании С номиналом 5000 ₽ куплена за 8200 ₽ 1 декабря. В январе выплачены дивиденды 20% от номинала = 1000 ₽. 1 мая из-за санкций цена упала на 50% от цены покупки: 8200 × 0,5 = 4100 ₽. Продажа: <code>1000 (дивиденды) – 4100 (убыток) = –3100 ₽</code>. Налог на дивиденды и комиссии не учтены (убыток налогом не облагается).',
                '31 января куплено 1000 дирхам по курсу 20,7921 ₽ и 1000 евро по курсу 89,5400 ₽. Продажа: дирхам 30 июня по 21,4225 ₽, евро 31 мая по 82,9705 ₽.<br><br>Дирхам: <code>(21,4225–20,7921)×1000 = +630,40 ₽</code><br>Евро: <code>(82,9705–89,5400)×1000 = –6569,50 ₽</code><br><strong>Итого: –5939,10 ₽</strong>',
                'Пример для ПИФ пока в разработке.',
                'Пример для Золота пока в разработке.'
            ];

            const contents = document.querySelectorAll('.asset-content');
            const dots = document.querySelectorAll('.dot');
            const counter = document.getElementById('pageCounter');
            const mainTitle = document.getElementById('mainTitle');
            const subTitle = document.getElementById('subTitle');
            const overlay = document.getElementById('exampleOverlay');
            const closeBtn = document.getElementById('closeExample');
            const questionCircle = document.getElementById('questionCircle');
            const contentCard = document.getElementById('contentCard');
            const exampleTitle = document.getElementById('exampleTitle');
            const exampleDesc = document.getElementById('exampleDesc');

            let isTransitioning = false;
            let resizeTimeout;

            function updateView(index) {
                if (isTransitioning) return;
                isTransitioning = true;

                contents.forEach(el => {
                    el.classList.remove('active');
                    el.style.display = 'none';
                });

                const activeContent = contents[index];
                activeContent.style.display = 'flex';

                requestAnimationFrame(() => {
                    activeContent.classList.add('active');

                    dots.forEach(d => d.classList.remove('active'));
                    dots[index].classList.add('active');
                    counter.textContent = `${index + 1} / ${assets.length}`;
                    mainTitle.textContent = titles[index];
                    subTitle.textContent = subtitles[index];

                    exampleTitle.textContent = exampleTitles[index];
                    exampleDesc.innerHTML = exampleDescs[index];

                    isTransitioning = false;
                });

                closeOverlay();
            }

            function goTo(index) {
                if (index < 0) index = assets.length - 1;
                if (index >= assets.length) index = 0;
                currentIndex = index;
                updateView(currentIndex);
            }

            function openOverlay() {
                overlay.classList.add('visible');
                contentCard.classList.add('blurred');
            }

            function closeOverlay() {
                overlay.classList.remove('visible');
                contentCard.classList.remove('blurred');
            }

            document.getElementById('prevBtn').addEventListener('click', () => goTo(currentIndex - 1));
            document.getElementById('nextBtn').addEventListener('click', () => goTo(currentIndex + 1));

            dots.forEach((dot, i) => {
                dot.addEventListener('click', () => goTo(i));
            });

            questionCircle.addEventListener('click', function(e) {
                e.stopPropagation();
                if (overlay.classList.contains('visible')) {
                    closeOverlay();
                } else {
                    openOverlay();
                }
            });

            closeBtn.addEventListener('click', closeOverlay);

            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    closeOverlay();
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && overlay.classList.contains('visible')) {
                    closeOverlay();
                }
            });

            const firstContent = contents[0];
            firstContent.style.display = 'flex';
            requestAnimationFrame(() => {
                firstContent.classList.add('active');
            });

            globalThis.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    const active = contents[currentIndex];
                    if (active) {
                        contents.forEach(el => el.style.display = 'none');
                        active.style.display = 'flex';
                        requestAnimationFrame(() => {
                            active.classList.add('active');
                        });
                    }
                }, 200);
            });
        })();
    } catch (e) {
        console.error('bootstrapTeaching error', e);
    }
}

const bootstrapPageModules = () => {
    try {
        bootstrapAppShell();
        bootstrapTrade();
        bootstrapPortfolio();
        bootstrapTeaching();
        bootstrapEventUI();
        updateDayBadge();
        setPauseState(true);
        document.addEventListener('keydown', (event) => {
            if ((event.code === 'Space' || event.key === ' ') && document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                return;
            }

            if (event.code === 'Space' || event.key === ' ') {
                event.preventDefault();
                togglePauseState();
            }
        }, { passive: false });
    } catch (error) {
        console.error('page bootstraps failed', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bootstrapPageModules();
    }, { once: true });
} else {
    bootstrapPageModules();
}

// End game immediately and show results (even if year not finished)
async function endGameNow() {
    try {
        setPauseState(true);
        stopGameClock();

        // persist current state before showing results
        try {
            const playerName = getCurrentGameId();
            await storage.saveGame(playerName, gameData);
        } catch (e) {
            console.warn('Не удалось сохранить игру перед показом результатов:', e);
        }

        // ensure initial snapshot exists
        try {
            if (!gameData._initialSnapshot) {
                const safeYear = Number(gameData.year) || 2007;
                gameData._initialSnapshot = computePortfolioSnapshot(getGameStartDate(safeYear));
            }
        } catch (e) {
            console.warn('Ошибка при создании начального снимка перед завершением:', e);
        }

        // show results
        try {
            showYearResults();
        } catch (e) {
            console.error('Ошибка при отображении результатов:', e);
            if (typeof window.showPage === 'function') window.showPage('results');
        }
    } catch (e) {
        console.error('endGameNow failed', e);
    }
}

// expose for HTML onclick handlers
globalThis.startNewGame = startNewGame;
globalThis.endGameNow = endGameNow;

// --- Event UI integration ---
let _eventPrevPage = null;
let _eventPrevPaused = null;

function bootstrapEventUI() {
    try {
        const acceptBtn = document.getElementById('eventAccept');
        if (acceptBtn) {
            acceptBtn.addEventListener('click', async () => {
                try {
                    const eventObj = gameData && gameData.pendingEvent;
                    if (!eventObj) {
                        closeEventScreen();
                        return;
                    }

                    // apply decision via engine
                    try {
                        gameEngine.changeCash(gameData, eventObj.amount);
                    } catch (e) {
                        console.error('Ошибка при применении решения события:', e);
                        alert(e.message || 'Ошибка при обработке события');
                        return;
                    }

                    // persist and refresh
                    try {
                        const playerName = getCurrentGameId();
                        await storage.saveGame(playerName, gameData);
                    } catch (e) {
                        console.warn('Не удалось сохранить после события:', e);
                    }
                    gameData.pendingEvent = null;
                    refreshVisiblePage();
                    closeEventScreen();
                } catch (e) {
                    console.error('event accept handler failed', e);
                }
            });
        }
    } catch (e) {
        console.error('bootstrapEventUI error', e);
    }
}

function triggerTestEvent() {
    try {
        if (gameData && gameData.pendingEvent) {
            showPendingEvent();
            return;
        }

        const eventObj = gameEngine && typeof gameEngine.createRandomEvent === 'function'
            ? gameEngine.createRandomEvent()
            : null;

        if (!eventObj) {
            console.warn('Невозможно создать тестовый ивент: gameEngine.createRandomEvent недоступен');
            return;
        }

        gameData.pendingEvent = eventObj;
        showPendingEvent();
    } catch (e) {
        console.error('triggerTestEvent error', e);
    }
}

globalThis.triggerTestEvent = triggerTestEvent;

function showPendingEvent() {
    try {
        const ev = gameData && gameData.pendingEvent;
        if (!ev) return;
        const prev = document.querySelector('.page-section.active');
        _eventPrevPage = prev ? prev.id : null;
        _eventPrevPaused = gameClock.isPaused;

        // populate UI
        const root = document.getElementById('event');
        if (!root) return;
        const icon = root.querySelector('.event-icon');
        const title = root.querySelector('.event-title');
        const amount = root.querySelector('.event-amount');
        const desc = root.querySelector('.event-desc');
        const accept = root.querySelector('#eventAccept');
        const isGood = ev.amount > 0;

        if (icon) {
            icon.textContent = ev.icon || '';
            icon.style.background = isGood ? '#E8F8EA' : '#FDECEC';
        }
        if (title) title.textContent = ev.title || '';
        if (amount) {
            amount.textContent = ev.amount;
            amount.style.color = isGood ? '#2BAE59' : '#D94A4A';
        }
        if (desc) desc.textContent = ev.text || '';
        if (accept) {
            accept.textContent = ev.buttonText;
            accept.style.background = isGood ? '#2BAE59' : '#D94A4A';
        }
        setPauseState(true);
        if (typeof window.showPage === 'function') window.showPage('event');
    } catch (e) {
        console.error('showPendingEvent error', e);
    }
}

function closeEventScreen() {
    try {
        // hide event page and return to previous
        if (_eventPrevPage && typeof window.showPage === 'function') {
            window.showPage(_eventPrevPage);
        } else if (typeof window.showPage === 'function') {
            window.showPage('portfolio');
        }

        // restore pause state
        if (!_eventPrevPaused) {
            setPauseState(false);
            startGameClock();
        } else {
            setPauseState(true);
        }
    } catch (e) {
        console.error('closeEventScreen error', e);
    }
}