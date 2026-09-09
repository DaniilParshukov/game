import { GameEngine } from './core/GameEngine.js';
import { LocalStorageAdapter } from './core/LocalStorageAdapter.js';
import { LocalPrices } from './prices/LocalPrices.js';

const storage = new LocalStorageAdapter();
globalThis.CopilkaStorage = LocalStorageAdapter;

let prices = null;
let gameData = null;

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

function createDefaultGameState() {
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

function getCurrentGameId() {
    try {
      return localStorage.getItem('copilka-player-name');
    } catch (error) {
      throw new Error('Не удалось загрузить имя игрока из localStorage: ' + error.message);
    }
}

const gameEngine = new GameEngine(storage, prices);

function getTickerByName(name) {
    const selected = gameData?.selectedTickers || createDefaultSelectedTickers();
    const bonds = Array.isArray(selected.bonds) ? selected.bonds : [];
    const stocks = Array.isArray(selected.stocks) ? selected.stocks : [];
    const fundTickers = Array.isArray(selected.fundTickers) ? selected.fundTickers : [];
    const usdTicker = selected.usdTicker || 'USD';
    const goldTicker = selected.goldTicker || 'GLDRUB';

    const normalized = String(name || '').trim().toLowerCase();
    const directTicker = String(name || '').trim();
    if (/^[A-Z0-9_./-]+$/.test(directTicker) && directTicker.length > 2) {
        return directTicker;
    }

    const lookup = {
        'ставка': selected.bankTicker || 'BANK',
        'офз': bonds[0],
        'корпоративные': bonds[1],
        'вдо': bonds[2],
        'пиф1': fundTickers[0],
        'пиф2': fundTickers[1],
        'акция1': stocks[0],
        'акция2': stocks[1],
        'акция3': stocks[2],
        'usd': usdTicker,
        'доллар': usdTicker,
        '1 грамм': goldTicker,
        'золото': goldTicker,
        'gold': goldTicker
    };

    if (lookup[normalized]) {
        return lookup[normalized];
    }

    const directMatch = Object.values(lookup).find((value) => String(value) === directTicker);
    if (directMatch) {
        return directMatch;
    }

    throw new Error(`Тикер не найден для названия: ${name}`);
}

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

function createNewGame() {
    return createDefaultGameState();
}

async function loadGame() {
    const playerName = getCurrentGameId();
    const saved = await storage.loadGame(playerName);
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
    await storage.saveGame(playerName, gameData);
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
        const year = gameData?.year;
        prices = await LocalPrices.create(year);
        gameEngine.prices = prices;
    }

    return gameData;
}

async function resetGame() {
    const playerName = getCurrentGameId();
    await storage.deleteGame(playerName);
    gameData = createNewGame();
    await storage.saveGame(playerName, gameData);
    return gameData;
}

globalThis.game = {
    data: () => gameData,
    engine: gameEngine,
    getPrices: () => prices,
    getStorage: () => storage,
    getTickerByName,
    initialize: initializeGame,
    reset: resetGame
};

async function bootstrapAppShell() {
    try {
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
            };

            button.addEventListener('click', submit);
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    submit();
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
            // original trade.js code adapted to local scope
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

            function readGameState() {
                try {
                    const gameApi = globalThis.game;
                    const liveState = gameApi && typeof gameApi.data === 'function' ? gameApi.data() : null;
                    if (liveState) return liveState;

                    if (gameApi && typeof gameApi.initialize === 'function') {
                        void gameApi.initialize().then(() => {
                            try { updateUI(); } catch (error) { console.log(error); }
                        }).catch(() => {});
                    }

                    return {
                        selectedTickers: createDefaultSelectedTickers(),
                        portfolio: createDefaultGameState().portfolio,
                        currentDay: 1
                    };
                } catch (err) {
                    console.warn('Не удалось прочитать состояние игры', err);
                    return {
                        selectedTickers: createDefaultSelectedTickers(),
                        portfolio: createDefaultGameState().portfolio,
                        currentDay: 1
                    };
                }
            }

            function safeNumber(value) {
                return Number.isFinite(Number(value)) ? Number(value) : 0;
            }

            function formatMoney(value) {
                return `${Math.round(safeNumber(value)).toLocaleString('ru-RU')} ₽`;
            }

            function resolveTickerByAsset() {
                const state = readGameState();
                const selected = state?.selectedTickers || createDefaultSelectedTickers();
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
                const state = readGameState();
                const selected = state?.selectedTickers || createDefaultSelectedTickers();
                const prices = globalThis.game && typeof globalThis.game.getPrices === 'function' ? globalThis.game.getPrices() : null;

                const usdTicker = selected.usdTicker;
                const goldTicker = selected.goldTicker;

                const fundList = Array.isArray(selected.fundTickers) ? selected.fundTickers : createDefaultSelectedTickers().fundTickers;
                const bondList = Array.isArray(selected.bonds) ? selected.bonds : createDefaultSelectedTickers().bonds;
                const stockList = Array.isArray(selected.stocks) ? selected.stocks : createDefaultSelectedTickers().stocks;

                if (bondList && bondList.length) {
                    currentBond = Math.min(currentBond, bondList.length - 1);
                    const bondTicker = bondList[currentBond];
                    assetData.bonds.label = bondTicker || '—';
                    assetData.bonds.price = (prices && typeof prices.getPrice === 'function' && bondTicker)
                        ? Number(prices.getPrice(bondTicker, state.currentDay) || -1)
                        : -1;
                } else {
                    assetData.bonds.label = '—';
                    assetData.bonds.price = -1;
                }

                if (stockList && stockList.length) {
                    currentStock = Math.min(currentStock, stockList.length - 1);
                    const stockTicker = stockList[currentStock];
                    assetData.stocks.label = stockTicker || '—';
                    assetData.stocks.price = (prices && typeof prices.getPrice === 'function' && stockTicker)
                        ? Number(prices.getPrice(stockTicker, state.currentDay) || -1)
                        : -1;
                } else {
                    assetData.stocks.label = '—';
                    assetData.stocks.price = -1;
                }

                if (fundList && fundList.length) {
                    currentPif = Math.min(currentPif, fundList.length - 1);
                    const pifTicker = fundList[currentPif];
                    assetData.pif.label = pifTicker || '—';
                    assetData.pif.price = (prices && typeof prices.getPrice === 'function' && pifTicker)
                        ? Number(prices.getPrice(pifTicker, state.currentDay) || -1)
                        : -1;
                } else {
                    assetData.pif.label = '—';
                    assetData.pif.price = -1;
                }

                assetData.currency.price = (prices && typeof prices.getPrice === 'function' && usdTicker)
                    ? Number(prices.getPrice(usdTicker, state.currentDay) || -1)
                    : -1;
                assetData.gold.price = (prices && typeof prices.getPrice === 'function' && goldTicker)
                    ? Number(prices.getPrice(goldTicker, state.currentDay) || -1)
                    : -1;

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
                    const priceVal = (Array.isArray(bondList) && bondList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(bondList[idx], state.currentDay) || -1) : -1) : -1;
                    if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'bond');
                });

                const stockElems = Array.from(document.querySelectorAll('#stocksSelection .selection-item'));
                stockElems.forEach((el, idx) => {
                    const priceSpan = el.querySelector('.price');
                    const priceVal = (Array.isArray(stockList) && stockList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(stockList[idx], state.currentDay) || -1) : -1) : -1;
                    if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'stock');
                });

                const pifElems = Array.from(document.querySelectorAll('#pifSelection .selection-item'));
                pifElems.forEach((el, idx) => {
                    const priceSpan = el.querySelector('.price');
                    const priceVal = (Array.isArray(fundList) && fundList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(fundList[idx], state.currentDay) || -1) : -1) : -1;
                    if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'pif');
                });

                const currencyPriceSpan = document.querySelector('#currencyInfo .price');
                if (currencyPriceSpan) currencyPriceSpan.textContent = fmtPrice(assetData.currency.price, 'currency');
                const goldPriceSpan = document.querySelector('#goldInfo .price');
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
                const state = readGameState();
                const available = document.querySelector('.deal-available');
                if (available) {
                    const cash = safeNumber(state?.portfolio?.cash);
                    const bank = safeNumber(state?.portfolio?.bankAccount?.balance);
                    available.textContent = `Доступно: ${formatMoney(cash + bank)}`;
                }

                const amount = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
                const price = currentAsset === 'account' ? 1 : (assetData[currentAsset]?.price || 0);
                if (totalAmount) totalAmount.textContent = `${(amount * price).toLocaleString('ru-RU')} ₽`;
            }

            function tryTrade(action) {
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
                    const state = readGameState();
                    const nextState = JSON.parse(JSON.stringify(state));

                    let result;
                    if (currentAsset === 'account') {
                        result = action === 'buy'
                            ? engine.openDeposit(nextState, quantity)
                            : engine.withdrawDeposit(nextState, 0, quantity);
                    } else {
                        const ticker = resolveTickerByAsset();
                        if (!ticker) {
                            alert('Тикер не выбран для текущего актива');
                            return;
                        }
                        result = action === 'buy' ? engine.buyAsset(nextState, ticker, quantity) : engine.sellAsset(nextState, ticker, quantity);
                    }

                    if (globalThis.game && typeof globalThis.game.data === 'function') {
                        globalThis.game.data = () => result;
                    }
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
                    tryTrade(currentAction === 'buy' ? 'buy' : 'sell');
                });
            }

            if (sellBtn) {
                sellBtn.addEventListener('click', () => {
                    tryTrade(currentAction === 'buy' ? 'sell' : 'buy');
                });
            }

            if (quantityInput) {
                quantityInput.value = '1000';
            }
            if (globalThis.game && typeof globalThis.game.initialize === 'function') {
                void globalThis.game.initialize().then(() => updateUI()).catch(() => updateUI());
            } else {
                updateUI();
            }
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

            async function readGameState() {
                try {
                    const gameApi = globalThis.game;
                    const liveState = gameApi && typeof gameApi.data === 'function' ? gameApi.data() : null;
                    if (liveState) {
                        debugPortfolio('liveState found', liveState);
                        return liveState;
                    }

                    debugPortfolio('Нет liveState, пытаемся инициализировать игру');

                    if (gameApi && typeof gameApi.initialize === 'function') {
                        const initialized = await gameApi.initialize();
                        if (initialized) {
                            debugPortfolio('game initialized', initialized);
                            return initialized;
                        }
                    }

                    debugPortfolio('Нет globalThis.game.initialize', !!gameApi, gameApi);

                    return {
                        selectedTickers: createDefaultSelectedTickers(),
                        portfolio: createDefaultGameState().portfolio,
                        currentDay: 1
                    };
                } catch (error) {
                    console.error('Не удалось прочитать состояние игры для портфеля: ', error);
                    return {
                        selectedTickers: createDefaultSelectedTickers(),
                        portfolio: createDefaultGameState().portfolio,
                        currentDay: 1
                    };
                }
            }

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
                debugPortfolio('Начало рендера портфеля');
                const gameData = await readGameState();
                const portfolio = gameData.portfolio || createDefaultGameState().portfolio;
                const bankBalance = Number(portfolio.bankAccount?.balance || 0);
                const cash = Number(portfolio.cash || 0);
                const total = cash + bankBalance + Object.values(portfolio.assetValues || {}).reduce((sum, asset) => sum + Number(asset.value || 0), 0) + Object.values(portfolio.deposits || {}).reduce((sum, positions) => {
                    if (!Array.isArray(positions)) return sum;
                    return sum + positions.reduce((inner, item) => inner + Number(item?.amount || 0), 0);
                }, 0);

                debugPortfolio('render data', { cash, bankBalance, total, currentDay: gameData.currentDay, selectedTickers: gameData.selectedTickers });

                const monthIndex = Math.max(1, Math.min(12, Math.ceil((Number(gameData.currentDay || 1) / 30) || 1)));
                const badge = document.querySelector('.month-badge');
                if (badge) badge.textContent = `МЕСЯЦ ${monthIndex} ИЗ 12`;

                const summaryValues = document.querySelectorAll('.stats-row .stat-card .value');
                if (summaryValues.length >= 2) {
                    summaryValues[0].textContent = formatMoney(total);
                    summaryValues[1].textContent = formatMoney(cash);
                }

                const rows = Array.from(document.querySelectorAll('.asset-row'));
                const values = [
                    { label: 'Накопительный счёт', value: bankBalance, color: 'fill-green' },
                    { label: 'ОФЗ', value: collectAssetValue(portfolio, [gameData.selectedTickers.bonds[0]]), color: 'fill-dark' },
                    { label: 'Корп. облигации', value: collectAssetValue(portfolio, [gameData.selectedTickers.bonds[1]]), color: 'fill-mint' },
                    { label: 'ВДО', value: collectAssetValue(portfolio, [gameData.selectedTickers.bonds[2]]), color: 'fill-gold' },
                    { label: 'ПИФ', value: collectAssetValue(portfolio, gameData.selectedTickers.fundTickers), color: 'fill-sand' },
                    { label: 'Акции', value: collectAssetValue(portfolio, gameData.selectedTickers.stocks), color: 'fill-blue' },
                    { label: 'Иностранная валюта', value: collectAssetValue(portfolio, [gameData.selectedTickers.usdTicker]), color: 'fill-purple' },
                    { label: 'Золото', value: collectAssetValue(portfolio, [gameData.selectedTickers.goldTicker]), color: 'fill-teal' }
                ];

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

            globalThis.refreshPortfolio = async function refreshPortfolioPage() {
                if (!document.querySelector('.portfolio-table')) return;
                await renderPortfolio();
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', bootstrapPortfolioInner, { once: true });
            } else {
                bootstrapPortfolioInner();
            }
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
    } catch (error) {
        console.error('page bootstraps failed', error);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void initializeGame()
            .then(() => bootstrapPageModules())
            .catch((error) => {
                console.error('Failed to initialize game', error);
                bootstrapPageModules();
            });
    }, { once: true });
} else {
    void initializeGame()
        .then(() => bootstrapPageModules())
        .catch((error) => {
            console.error('Failed to initialize game', error);
            bootstrapPageModules();
        });
}