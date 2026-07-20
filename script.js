// script.js

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
const portfolioEl = document.getElementById('portfolio');
const logEl = document.getElementById('log');
const marketCardsEl = document.getElementById('marketCards');
const nextDayBtn = document.getElementById('nextDay');
const buyBtn = document.getElementById('buy');
const sellBtn = document.getElementById('sell');
const resetBtn = document.getElementById('reset');
const continueBtn = document.getElementById('continue');

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
            assetValues: {}
        },
        currentDay: 1,
        history: []
    };
}

function renderUI() {
    if (!gameData) return;

    const portfolio = gameData.portfolio;
    const total = gameEngine.getTotalValue(portfolio);

    balanceEl.textContent = `Наличные ${Math.round(portfolio.cash)} руб.`;
    totalStateEl.textContent = `Общее состояние: ${Math.round(total)} руб.`;
    dayEl.textContent = `День ${gameData.currentDay} / 365`;

    renderPortfolio();
    renderLog();
    renderMarketCards();
}

function renderMarketCards() {
    const tickers = ['SBER', 'GAZP', 'YNDX', 'OZFZ', 'GOLD'];
    const cards = tickers.map((ticker) => {
        const price = prices.getPrice(ticker, gameData.currentDay);
        const quantity = gameData.portfolio.assets[ticker] || 0;
        const assetValue = gameData.portfolio.assetValues?.[ticker]?.value || 0;
        const label = getTickerLabel(ticker);

        return `
            <article class="instrument-card">
                <div class="instrument-head">
                    <div>
                        <div class="instrument-name">${label}</div>
                        <div class="instrument-ticker">${ticker}</div>
                    </div>
                    <span class="instrument-pill">${quantity > 0 ? `${quantity} шт.` : 'Нет позиции'}</span>
                </div>
                <div class="instrument-metrics">
                    <div>
                        <div class="metric-label">Цена</div>
                        <div class="metric-value">${price.toFixed(2)} руб.</div>
                    </div>
                    <div>
                        <div class="metric-label">Позиция</div>
                        <div class="metric-value">${quantity > 0 ? `${assetValue.toFixed(2)} руб.` : '—'}</div>
                    </div>
                </div>
                <div class="instrument-footer">
                    <button class="chip-btn" data-action="set-ticker" data-ticker="${ticker}">Выбрать</button>
                </div>
            </article>
        `;
    }).join('');

    marketCardsEl.innerHTML = cards;
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

function renderPortfolio() {
    const portfolio = gameData.portfolio;
    const assetValues = portfolio.assetValues || {};

    if (Object.keys(assetValues).length === 0) {
        portfolioEl.innerHTML = '<div class="empty-state">Нет активов в портфеле</div>';
        return;
    }

    const rows = Object.entries(assetValues).map(([ticker, data]) => `
        <div class="folio-row">
            <div>
                <strong>${ticker}</strong>
                <div class="secondary">${data.quantity} шт.</div>
            </div>
            <div class="metric-value">${data.value.toFixed(2)} руб.</div>
        </div>
    `).join('');

    portfolioEl.innerHTML = `<div class="portfolio-wrap">${rows}</div>`;
}

function renderLog() {
    const history = gameData.history || [];
    if (history.length === 0) {
        logEl.innerHTML = '<div class="empty-state">История пуста</div>';
        return;
    }

    const lastEvents = history.slice(-5).reverse();
    const rows = lastEvents.map((event) => {
        const sign = event.type === 'BUY' ? 'Покупка' : 'Продажа';
        return `
            <div class="log-row">
                <div>
                    <strong>${sign} ${event.ticker}</strong>
                    <div class="secondary">${event.amount} шт. по ${event.price.toFixed(2)} руб.</div>
                </div>
                <div class="metric-value">${event.total.toFixed(2)} руб.</div>
            </div>
        `;
    }).join('');

    logEl.innerHTML = `<div class="log-wrap">${rows}</div>`;
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

function showFinalResult() {
    const recommendation = gameEngine.getRecommendation(gameData);
    const total = gameEngine.getTotalValue(gameData.portfolio);

    setTimeout(() => {
        alert(`Игра завершена.\nИтоговая сумма: ${Math.round(total)} руб.\nПрибыль: ${Math.round(recommendation.profit)} руб. (${recommendation.percent.toFixed(1)}%)\n\n${recommendation.text}`);
    }, 500);
}

async function handleBuy() {
    const ticker = document.getElementById('tickerInput').value.toUpperCase();
    const amount = parseInt(document.getElementById('amountInput').value, 10);

    if (!ticker || !amount || amount <= 0) {
        alert('Введите тикер и количество');
        return;
    }

    try {
        const price = prices.getPrice(ticker, gameData.currentDay);
        const cost = price * amount;

        if (gameData.portfolio.cash < cost) {
            alert(`Недостаточно средств. Нужно: ${cost.toFixed(2)} руб., есть: ${gameData.portfolio.cash.toFixed(2)} руб.`);
            return;
        }

        gameData = gameEngine.buyAsset(gameData, ticker, amount);
        await storage.saveGame(GAME_ID, gameData);
        renderUI();

        document.getElementById('tickerInput').value = '';
        document.getElementById('amountInput').value = '';
    } catch (error) {
        alert(`Ошибка: ${error.message}`);
    }
}

async function handleSell() {
    const ticker = document.getElementById('tickerInput').value.toUpperCase();
    const amount = parseInt(document.getElementById('amountInput').value, 10);

    if (!ticker || !amount || amount <= 0) {
        alert('Введите тикер и количество');
        return;
    }

    try {
        if (!gameData.portfolio.assets[ticker]) {
            alert(`У вас нет актива ${ticker}`);
            return;
        }

        if (gameData.portfolio.assets[ticker] < amount) {
            alert(`У вас только ${gameData.portfolio.assets[ticker]} акций ${ticker}`);
            return;
        }

        gameData = gameEngine.sellAsset(gameData, ticker, amount);
        await storage.saveGame(GAME_ID, gameData);
        renderUI();

        document.getElementById('tickerInput').value = '';
        document.getElementById('amountInput').value = '';
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

function handleSelectTicker(event) {
    const button = event.target.closest('[data-action="set-ticker"]');
    if (!button) return;

    const ticker = button.getAttribute('data-ticker');
    document.getElementById('tickerInput').value = ticker;
    document.getElementById('amountInput').focus();
}

nextDayBtn.addEventListener('click', handleNextDay);
buyBtn.addEventListener('click', handleBuy);
sellBtn.addEventListener('click', handleSell);
resetBtn.addEventListener('click', handleReset);
continueBtn.addEventListener('click', () => {
    document.getElementById('tickerInput').focus();
});
marketCardsEl.addEventListener('click', handleSelectTicker);

initGame();

window.game = {
    data: () => gameData,
    engine: gameEngine,
    prices: prices
};