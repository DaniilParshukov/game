import { GameEngine } from './core/GameEngine.js';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { LocalPrices } from './prices/LocalPrices.js';

const storage = new LocalStorageAdapter();
const prices = new LocalPrices();
const gameEngine = new GameEngine(storage, prices);

let gameData = null;
const GAME_ID = 'my_game';
let autoAdvanceTimer = null;
let autoAdvanceRemainingMs = 3000;
let autoAdvanceDeadline = null;
let autoAdvancePaused = false;

const balanceEl = document.getElementById('balance');
const totalStateEl = document.getElementById('totalState');
const dayEl = document.getElementById('day');
const dayTextEl = document.getElementById('dayText');
const marketCardsEl = document.getElementById('marketCards');
const nextDayBtn = document.getElementById('nextDay');
const pauseTimerBtn = document.getElementById('pauseTimer');
const resetBtn = document.getElementById('reset');
const eventModal = document.getElementById('eventModal');
const eventModalTitle = document.getElementById('eventModalTitle');
const eventModalText = document.getElementById('eventModalText');
const eventModalActions = document.getElementById('eventModalActions');

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
    startAutoAdvanceTimer();
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

function updateDayTimerUi() {
    if (dayTextEl) {
        dayTextEl.textContent = `День ${gameData.currentDay} / 365`;
    }

    if (!dayEl) return;
    if (gameData.currentDay >= 365) {
        dayEl.style.setProperty('--fill', '100%');
        return;
    }

    const progress = 100 - (autoAdvanceRemainingMs / 3000) * 100;
    dayEl.style.setProperty('--fill', `${Math.max(0, Math.min(100, progress))}%`);
}

function clearAutoAdvanceTimer() {
    if (autoAdvanceTimer) {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
    }
}

function startAutoAdvanceTimer() {
    clearAutoAdvanceTimer();

    if (!gameData || gameData.currentDay >= 365) {
        autoAdvanceRemainingMs = 3000;
        autoAdvanceDeadline = null;
        autoAdvancePaused = false;
        updateDayTimerUi();
        if (pauseTimerBtn) {
            pauseTimerBtn.disabled = true;
            pauseTimerBtn.textContent = 'Пауза';
        }
        return;
    }

    autoAdvanceRemainingMs = 3000;
    autoAdvanceDeadline = Date.now() + autoAdvanceRemainingMs;
    autoAdvancePaused = false;
    updateDayTimerUi();

    if (pauseTimerBtn) {
        pauseTimerBtn.disabled = false;
        pauseTimerBtn.textContent = 'Пауза';
    }

    autoAdvanceTimer = setInterval(() => {
        if (!gameData || autoAdvancePaused) return;

        autoAdvanceRemainingMs = Math.max(0, autoAdvanceDeadline - Date.now());
        updateDayTimerUi();

        if (autoAdvanceRemainingMs <= 0) {
            clearAutoAdvanceTimer();
            void handleNextDay();
        }
    }, 80);
}

function pauseAutoAdvanceTimer() {
    if (!gameData || gameData.currentDay >= 365 || autoAdvancePaused) return;

    autoAdvancePaused = true;
    autoAdvanceRemainingMs = Math.max(0, autoAdvanceDeadline - Date.now());
    clearAutoAdvanceTimer();
    updateDayTimerUi();

    if (pauseTimerBtn) {
        pauseTimerBtn.textContent = 'Продолжить';
    }
}

function resumeAutoAdvanceTimer() {
    if (!gameData || gameData.currentDay >= 365 || !autoAdvancePaused) return;

    autoAdvancePaused = false;
    autoAdvanceDeadline = Date.now() + autoAdvanceRemainingMs;
    updateDayTimerUi();

    if (pauseTimerBtn) {
        pauseTimerBtn.textContent = 'Пауза';
    }

    autoAdvanceTimer = setInterval(() => {
        if (!gameData || autoAdvancePaused) return;

        autoAdvanceRemainingMs = Math.max(0, autoAdvanceDeadline - Date.now());
        updateDayTimerUi();

        if (autoAdvanceRemainingMs <= 0) {
            clearAutoAdvanceTimer();
            void handleNextDay();
        }
    }, 80);
}

function renderUI() {
    if (!gameData) return;

    const portfolio = gameData.portfolio;
    const total = gameEngine.getTotalValue(portfolio);

    balanceEl.textContent = `${Math.round(portfolio.cash)} ₽`;
    totalStateEl.textContent = `Общее состояние: ${Math.round(total)} ₽`;
    updateDayTimerUi();

    renderMarketCards();

    if (gameData.pendingEvent) {
        pauseAutoAdvanceTimer();
        showEventModal(gameData.pendingEvent);
        resumeAutoAdvanceTimer();
    } else {
        hideEventModal();
    }
}

function getWeightedAverageProfitInfo(gameData, ticker) {
    const quantity = gameData?.portfolio?.assets?.[ticker] || 0;
    if (!quantity) {
        return { percent: 0, avgCost: 0, amount: 0 };
    }

    const currentPrice = prices.getPrice(ticker, gameData.currentDay);
    const transactions = (gameData?.history || []).filter((entry) => entry?.ticker === ticker && (entry?.type === 'BUY' || entry?.type === 'SELL'));

    let remainingQuantity = 0;
    let costBasis = 0;

    for (const entry of transactions) {
        const amount = Number(entry?.amount || 0);
        if (!amount) continue;

        if (entry.type === 'BUY') {
            remainingQuantity += amount;
            costBasis += amount * Number(entry.price || 0);
        } else if (entry.type === 'SELL') {
            const sellQty = Math.min(amount, remainingQuantity);
            if (remainingQuantity <= 0) continue;
            const avgCost = remainingQuantity > 0 ? costBasis / remainingQuantity : 0;
            costBasis -= avgCost * sellQty;
            remainingQuantity -= sellQty;
        }
    }

    if (remainingQuantity <= 0 || !costBasis) {
        return { percent: 0, avgCost: 0, amount: 0 };
    }

    const avgCost = costBasis / remainingQuantity;
    const percent = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
    return {
        percent,
        avgCost,
        amount: (currentPrice - avgCost) * quantity
    };
}

function renderMarketCards() {
    const depositProducts = [
        { key: 'bank', label: 'Банковский счёт', rate: '6%', term: '30 дней' },
        { key: 'ofz', label: 'ОФЗ', rate: '8%', term: '90 дней' },
        { key: 'bonds', label: 'Корп. обл.', rate: '10%', term: '180 дней' }
    ];
    const tickers = ['SBER', 'GAZP', 'YNDX', 'USD', 'GOLD'];
    

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
        const profitInfo = getWeightedAverageProfitInfo(gameData, ticker);
        const profitText = quantity > 0 ? `${profitInfo.percent >= 0 ? '+' : ''}${profitInfo.percent.toFixed(1)}%` : '0%';

        return `
            <article class="instrument-card ${ticker}">
                <div class="instrument-head">
                    <div>
                        <div class="instrument-name">${label}</div>
                        <div class="instrument-ticker">${ticker}</div>
                    </div>
                    <span class="instrument-pill-spacer"></span>
                    <span class="instrument-pill">${quantity > 0 ? `${quantity} шт.` : 'Нет'}</span>
                    <span class="instrument-pill">${profitText}</span>
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
                        <span class="instrument-pill">${Math.round((gameData.portfolio.bankAccount?.balance || 0)) >= 0 ? product.rate : 'кредит ' + 2 * parseFloat(product.rate) + '%'}</span>
                    </div>
                    <div class="instrument-price-row">
                        <div class="price-value ${Math.round((gameData.portfolio.bankAccount?.balance || 0)) >= 0 ? 'up' : 'down'}">${Math.round((gameData.portfolio.bankAccount?.balance || 0))} ₽</div>
                        <div class="price-change ${Math.round((gameData.portfolio.bankAccount?.balance || 0)) >= 0 ? 'up' : 'down'}">${Math.round((gameData.portfolio.bankAccount?.balance || 0)) >= 0 ? 'Счёт' : 'Кредит'}</div>
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
                    <span class="instrument-pill-spacer"></span>
                    <span class="instrument-pill">${product.term}</span>
                    <span class="instrument-pill">${product.rate}</span>
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
        case 'USD': return 'Доллар';
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

    eventModalTitle.textContent = event?.title || 'Событие';
    eventModalText.textContent = event?.text || '';
    eventModalActions.innerHTML = '';

    if (!event) {
        eventModal.classList.add('hidden');
        eventModal.setAttribute('aria-hidden', 'true');
        return;
    }

    const actionType = event.actionType || (event.amount > 0 ? 'gain' : 'info');
    const cashAvailable = (gameData?.portfolio?.cash || 0) >= Math.abs(event.amount || 0);

    if (actionType === 'cost') {
        const spendBtn = document.createElement('button');
        spendBtn.className = 'btn btn-secondary';
        spendBtn.type = 'button';
        spendBtn.textContent = cashAvailable ? `Потратить наличные (${Math.round(Math.abs(event.amount || 0))} ₽)` : `Потратить наличные (нет)`;
        spendBtn.disabled = !cashAvailable;
        spendBtn.dataset.eventChoice = 'cash';
        eventModalActions.appendChild(spendBtn);

        const bankBtn = document.createElement('button');
        bankBtn.className = 'btn btn-primary';
        bankBtn.type = 'button';
        bankBtn.textContent = `Взять из банка (${Math.round(Math.abs(event.amount || 0))} ₽)`;
        bankBtn.dataset.eventChoice = 'bank';
        eventModalActions.appendChild(bankBtn);
    } else {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'btn btn-primary';
        actionBtn.type = 'button';
        actionBtn.textContent = event.buttonText || 'Продолжить';
        actionBtn.dataset.eventChoice = actionType === 'gain' ? 'receive' : 'close';
        eventModalActions.appendChild(actionBtn);
    }

    eventModal.classList.remove('hidden');
    eventModal.setAttribute('aria-hidden', 'false');
}

function hideEventModal() {
    if (!eventModal) return;

    eventModal.classList.add('hidden');
    eventModal.setAttribute('aria-hidden', 'true');
    eventModalActions.innerHTML = '';
}

async function handleEventChoice(choice) {
    if (!gameData?.pendingEvent) {
        hideEventModal();
        return;
    }

    try {
        gameData = gameEngine.applyEventDecision(gameData, gameData.pendingEvent, choice);
        await storage.saveGame(GAME_ID, gameData);
        renderUI();
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
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

nextDayBtn.addEventListener('click', () => {
    clearAutoAdvanceTimer();
    void handleNextDay();
});
pauseTimerBtn?.addEventListener('click', () => {
    if (autoAdvancePaused) {
        resumeAutoAdvanceTimer();
    } else {
        pauseAutoAdvanceTimer();
    }
});
resetBtn.addEventListener('click', handleReset);
marketCardsEl.addEventListener('click', handleCardAction);
eventModalActions?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-event-choice]');
    if (!button) return;
    void handleEventChoice(button.getAttribute('data-event-choice'));
});

initGame();

window.game = {
    data: () => gameData,
    engine: gameEngine,
    prices: prices
};