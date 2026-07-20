import { GameEngine } from './core/GameEngine.js';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { LocalPrices } from './prices/LocalPrices.js';

const storage = new LocalStorageAdapter();
const prices = new LocalPrices();
const gameEngine = new GameEngine(storage, prices);

let gameData = null;
const GAME_ID = 'my_game';

const balanceEl = document.getElementById('balance');
const totalStateEl = document.getElementById('totalState');
const dayEl = document.getElementById('day');
const marketCardsEl = document.getElementById('marketCards');
const nextDayBtn = document.getElementById('nextDay');
const resetBtn = document.getElementById('reset');
const eventModal = document.getElementById('eventModal');
const eventModalTitle = document.getElementById('eventModalTitle');
const eventModalText = document.getElementById('eventModalText');
const eventModalContinueBtn = document.getElementById('eventModalContinue');

async function initGame() {
    const saved = await storage.loadGame(GAME_ID);

    if (saved) {
        gameData = saved;
        console.log('Загружена сохранённая игра');
    } else {
        gameData = createNewGame();
        await storage.saveGame(GAME_ID, gameData);
        console.log('Создана новая игра');
    }

    renderUI();
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

function renderUI() {
    if (!gameData) return;

    const portfolio = gameData.portfolio;
    const total = gameEngine.getTotalValue(portfolio);

    balanceEl.textContent = `${Math.round(portfolio.cash)} ₽`;
    totalStateEl.textContent = `Общее состояние: ${Math.round(total)} ₽`;
    dayEl.textContent = `День ${gameData.currentDay} / 365`;

    renderMarketCards();

    if (gameData.pendingEvent) {
        showEventModal(gameData.pendingEvent);
    } else {
        hideEventModal();
    }
}

function renderMarketCards() {
    const depositProducts = [
        { key: 'bank', label: 'Банковский счёт', rate: '6%', term: '30 дней' },
        { key: 'ofz', label: 'ОФЗ', rate: '8%', term: '90 дней' },
        { key: 'bonds', label: 'Корп. облигации', rate: '10%', term: '180 дней' }
    ];
    const tickers = ['SBER', 'GAZP', 'YNDX', 'OZFZ', 'GOLD'];
    

    const stockCards = tickers.map((ticker) => {
        const price = prices.getPrice(ticker, gameData.currentDay);
        const history = prices.getHistory(ticker);
        const prevPrice = history[Math.max(0, Math.min(history.length - 1, gameData.currentDay - 2))] ?? price;
        const change = price - prevPrice;
        const changePct = prevPrice ? (change / prevPrice) * 100 : 0;
        const quantity = gameData.portfolio.assets[ticker] || 0;
        const label = getTickerLabel(ticker);
        const directionClass = change >= 0 ? 'up' : 'down';
        const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(2)} ₽ (${change >= 0 ? '+' : ''}${changePct.toFixed(1)}%)`;

        return `
            <article class="instrument-card ${ticker}">
                <div class="instrument-head">
                    <div>
                        <div class="instrument-name">${label}</div>
                        <div class="instrument-ticker">${ticker}</div>
                    </div>
                    <span class="instrument-pill">${quantity > 0 ? `${quantity} шт.` : 'Нет'}</span>
                </div>
                <div class="instrument-price-row">
                    <div class="price-value ${directionClass}">${price.toFixed(2)} ₽</div>
                    <div class="price-change ${directionClass}">${changeText}</div>
                </div>
                <div class="candle-wrap" title="${ticker}: ${price.toFixed(2)} ₽">${buildPriceChart(history, gameData.currentDay, directionClass)}</div>
                <div class="card-controls">
                    <select class="card-amount" data-ticker="${ticker}">
                        <option value="1">1</option>
                        <option value="10">10</option>
                        <option value="100">100</option>
                        <option value="all" selected>All</option>
                    </select>
                    <button class="btn btn-secondary action-btn" data-action="buy" data-ticker="${ticker}">Купить</button>
                    <button class="btn btn-muted action-btn" data-action="sell" data-ticker="${ticker}">Продать</button>
                </div>
            </article>
        `;
    }).join('');

    const depositCards = depositProducts.map((product) => {
        const positions = Array.isArray(gameData.portfolio.deposits?.[product.key]) ? gameData.portfolio.deposits[product.key] : [];

        if (product.key === 'bank') {
            return `
                <article class="instrument-card deposit-card">
                    <div class="instrument-head">
                        <div>
                            <div class="instrument-name">${product.label}</div>
                            <div class="instrument-ticker">${product.key.toUpperCase()}</div>
                        </div>
                        <span class="instrument-pill">${product.rate}</span>
                    </div>
                    <div class="instrument-price-row">
                        <div class="price-value up">${Math.round((gameData.portfolio.bankAccount?.balance || 0))} ₽</div>
                        <div class="price-change up">Счёт</div>
                    </div>
                    <div class="card-controls">
                        <input class="card-amount" type="number" min="100" step="100" value="1000" data-deposit="${product.key}" />
                        <button class="btn btn-secondary action-btn" data-action="deposit" data-ticker="${product.key}">Вложить</button>
                        <button class="btn btn-muted action-btn" data-action="withdraw" data-ticker="${product.key}">Снять</button>
                    </div>
                </article>
            `;
        }

        const lines = positions.length
            ? positions.map((deposit, index) => {
                const termDays = deposit.termDays ?? 0;
                const canWithdraw = termDays === 0;
                return `
                    <div class="deposit-line">
                        <div class="deposit-line-top">
                            <span>${(deposit.amount || 0).toFixed(0)} ₽</span>
                            <button class="btn btn-secondary action-btn" data-action="withdraw" data-ticker="${product.key}" data-index="${index}">${canWithdraw ? 'Забрать' : `${termDays}д`}</button>
                        </div>
                    </div>
                `;
            }).join('')
            : '<div class="deposit-empty">Нет активных вкладов</div>';

        return `
            <article class="instrument-card deposit-card">
                <div class="instrument-head">
                    <div>
                        <div class="instrument-name">${product.label}</div>
                        <div class="instrument-ticker">${product.key.toUpperCase()}</div>
                    </div>
                    <span class="instrument-pill">${product.rate}</span>
                </div>
                <div class="instrument-price-row">
                    <div class="price-value up">${positions.length ? `${positions.length}/3` : '0/3'}</div>
                    <div class="price-change up">${product.term}</div>
                </div>
                <div class="deposit-list">${lines}</div>
                <div class="card-controls">
                    <input class="card-amount" type="number" min="100" step="100" value="1000" data-deposit="${product.key}" />
                    <button class="btn btn-secondary action-btn" data-action="deposit" data-ticker="${product.key}">Вложить</button>
                </div>
            </article>
        `;
    }).join('');

    marketCardsEl.innerHTML = `${depositCards}${stockCards}`;
}

function buildPriceChart(history, day, directionClass) {
    const slice = history.slice(Math.max(0, day - 24), Math.min(day, history.length - 1));
    if (!slice.length) return '<div class="empty-state">Нет данных</div>';

    const width = 180;
    const height = 54;
    const padding = 4;
    const max = Math.max(...slice);
    const min = Math.min(...slice);
    const range = max - min || 1;

    const points = slice.map((value, index) => {
        const x = padding + (index / Math.max(1, slice.length - 1)) * (width - padding * 2);
        const y = padding + ((max - value) / range) * (height - padding * 2);
        return { x, y };
    });

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];
    const color = directionClass == 'up' ? '#2dd4bf' : '#ff4d6d';

    return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="54" preserveAspectRatio="none">
            <rect x="0" y="0" width="${width}" height="${height}" rx="8" fill="rgba(255,255,255,0.02)"></rect>
            <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <circle cx="${lastPoint.x.toFixed(2)}" cy="${lastPoint.y.toFixed(2)}" r="2.8" fill="${color}"></circle>
            <circle cx="${firstPoint.x.toFixed(2)}" cy="${firstPoint.y.toFixed(2)}" r="1.8" fill="rgba(255,255,255,0.6)"></circle>
        </svg>
    `;
}

function getTickerLabel(ticker) {
    switch (ticker) {
        case 'SBER': return 'Сбербанк';
        case 'GAZP': return 'Газпром';
        case 'YNDX': return 'Яндекс';
        case 'OZFZ': return 'ОФЗ';
        case 'GOLD': return 'Золото';
        default: return ticker;
    }
}

async function handleNextDay() {
    if (gameData.currentDay >= 365) {
        alert('Игра завершена. Нажмите "Сброс", чтобы начать заново');
        return;
    }

    gameData = gameEngine.nextDay(gameData);
    await storage.saveGame(GAME_ID, gameData);
    renderUI();

    if (gameData.currentDay === 365) {
        showFinalResult();
    }
}

function showEventModal(event) {
    if (!eventModal) return;

    eventModalTitle.textContent = event.title || 'Событие';
    eventModalText.textContent = event.text || '';
    eventModal.classList.remove('hidden');
    eventModal.setAttribute('aria-hidden', 'false');
}

function hideEventModal() {
    if (!eventModal) return;

    eventModal.classList.add('hidden');
    eventModal.setAttribute('aria-hidden', 'true');
}

async function handleCloseEventModal() {
    if (gameData) {
        gameData.pendingEvent = null;
        await storage.saveGame(GAME_ID, gameData);
    }
    hideEventModal();
}

function showFinalResult() {
    const recommendation = gameEngine.getRecommendation(gameData);
    const total = gameEngine.getTotalValue(gameData.portfolio);

    setTimeout(() => {
        alert(`Игра завершена.\nИтоговая сумма: ${Math.round(total)} руб.\nПрибыль: ${Math.round(recommendation.profit)} руб. (${recommendation.percent.toFixed(1)}%)\n\n${recommendation.text}`);
    }, 500);
}

async function handleDepositAction(action, ticker, index) {
    const card = marketCardsEl.querySelector(`.instrument-card [data-deposit="${ticker}"]`)?.closest('.instrument-card');
    const input = card?.querySelector('[data-deposit]');
    const amount = input ? parseFloat(input.value) : 0;

    try {
        if (action === 'deposit') {
            gameData = gameEngine.openDeposit(gameData, ticker, amount);
        } else if (action === 'withdraw') {
            gameData = gameEngine.withdrawDeposit(gameData, ticker, Number(index), amount);
        }

        await storage.saveGame(GAME_ID, gameData);
        renderUI();
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

async function handleTrade(type, ticker, amount, mode) {
    let resolvedAmount = amount;

    if (mode === 'all') {
        if (type === 'buy') {
            const price = prices.getPrice(ticker, gameData.currentDay);
            resolvedAmount = Math.max(1, Math.floor(gameData.portfolio.cash / price));
        } else {
            resolvedAmount = gameData.portfolio.assets[ticker] || 0;
        }
    }

    if (!ticker || !resolvedAmount || resolvedAmount <= 0) {
        alert('Введите количество');
        return;
    }

    try {
        if (type === 'buy') {
            const price = prices.getPrice(ticker, gameData.currentDay);
            const cost = price * resolvedAmount;

            if (gameData.portfolio.cash < cost) {
                alert(`Недостаточно средств. Нужно: ${cost.toFixed(2)} ₽, есть: ${gameData.portfolio.cash.toFixed(2)} ₽`);
                return;
            }

            gameData = gameEngine.buyAsset(gameData, ticker, resolvedAmount);
        } else {
            if (!gameData.portfolio.assets[ticker]) {
                alert(`У вас нет актива ${ticker}`);
                return;
            }

            if (gameData.portfolio.assets[ticker] < resolvedAmount) {
                alert(`У вас только ${gameData.portfolio.assets[ticker]} акций ${ticker}`);
                return;
            }

            gameData = gameEngine.sellAsset(gameData, ticker, resolvedAmount);
        }

        await storage.saveGame(GAME_ID, gameData);
        renderUI();
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

async function handleReset() {
    if (confirm('Сбросить игру?')) {
        await storage.deleteGame(GAME_ID);
        gameData = createNewGame();
        await storage.saveGame(GAME_ID, gameData);
        renderUI();
    }
}

function handleCardAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    const action = button.getAttribute('data-action');
    const ticker = button.getAttribute('data-ticker');
    const index = button.getAttribute('data-index');

    if (action === 'deposit' || action === 'withdraw') {
        void handleDepositAction(action, ticker, index);
        return;
    }

    const card = button.closest('.instrument-card');
    const select = card?.querySelector('.card-amount');
    const mode = select?.value || '1';
    const amount = mode === 'all' ? null : parseInt(mode, 10);

    if (action === 'buy' || action === 'sell') {
        void handleTrade(action, ticker, amount, mode);
    }
}

nextDayBtn.addEventListener('click', handleNextDay);
resetBtn.addEventListener('click', handleReset);
marketCardsEl.addEventListener('click', handleCardAction);
eventModalContinueBtn?.addEventListener('click', () => {
    void handleCloseEventModal();
});

eventModal?.addEventListener('click', (event) => {
    if (event.target === eventModal) {
        void handleCloseEventModal();
    }
});

initGame();

window.game = {
    data: () => gameData,
    engine: gameEngine,
    prices: prices
};