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

    renderMarketCards();
}

function renderMarketCards() {
    const tickers = ['SBER', 'GAZP', 'YNDX', 'OZFZ', 'GOLD'];
    const cards = tickers.map((ticker) => {
        const price = prices.getPrice(ticker, gameData.currentDay);
        const history = prices.getHistory(ticker);
        const prevPrice = history[Math.max(0, Math.min(history.length - 1, gameData.currentDay - 2))] ?? price;
        const change = price - prevPrice;
        const changePct = prevPrice ? (change / prevPrice) * 100 : 0;
        const quantity = gameData.portfolio.assets[ticker] || 0;
        const assetValue = gameData.portfolio.assetValues?.[ticker]?.value || 0;
        const label = getTickerLabel(ticker);
        const directionClass = change >= 0 ? 'up' : 'down';
        const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(2)} руб. (${change >= 0 ? '+' : ''}${changePct.toFixed(1)}%)`;

        return `
            <article class="instrument-card ${directionClass}">
                <div class="instrument-head">
                    <div>
                        <div class="instrument-name">${label}</div>
                        <div class="instrument-ticker">${ticker}</div>
                    </div>
                    <span class="instrument-pill">${quantity > 0 ? `${quantity} шт.` : 'Позиции нет'}</span>
                </div>
                <div class="instrument-price-row">
                    <div class="price-value ${directionClass}">${price.toFixed(2)} руб.</div>
                    <div class="price-change ${directionClass}">${changeText}</div>
                </div>
                <div class="instrument-stats">
                    <div>
                        <div class="metric-label">В портфеле</div>
                        <div class="metric-value">${quantity > 0 ? `${quantity} шт.` : '—'}</div>
                    </div>
                    <div>
                        <div class="metric-label">Оценка</div>
                        <div class="metric-value">${quantity > 0 ? `${assetValue.toFixed(2)} руб.` : '—'}</div>
                    </div>
                </div>
                <div class="candle-wrap">${buildCandleChart(history, gameData.currentDay)}</div>
                <div class="instrument-footer">
                    <button class="chip-btn" data-action="set-ticker" data-ticker="${ticker}">Выбрать</button>
                </div>
            </article>
        `;
    }).join('');

    marketCardsEl.innerHTML = cards;
}

function buildCandleChart(history, currentDay) {
    const slice = history.slice(Math.max(0, history.length - 8));
    if (!slice.length) return '<div class="empty-state">Нет данных</div>';

    const width = 180;
    const height = 70;
    const padding = 8;
    const max = Math.max(...slice);
    const min = Math.min(...slice);
    const range = max - min || 1;
    const candleWidth = 14;
    const step = (width - padding * 2) / slice.length;

    const candles = slice.map((value, index) => {
        const prevValue = index === 0 ? slice[0] : slice[index - 1];
        const open = prevValue;
        const close = value;
        const high = Math.max(open, close);
        const low = Math.min(open, close);
        const x = padding + index * step + step / 2;
        const top = padding + ((max - high) / range) * (height - padding * 2);
        const bottom = padding + ((max - low) / range) * (height - padding * 2);
        const bodyTop = padding + ((max - Math.max(open, close)) / range) * (height - padding * 2);
        const bodyBottom = padding + ((max - Math.min(open, close)) / range) * (height - padding * 2);
        const bodyHeight = Math.max(4, bodyBottom - bodyTop);
        const color = close >= open ? '#2dd4bf' : '#ff4d6d';

        return `
            <g>
                <line x1="${x}" y1="${top}" x2="${x}" y2="${bottom}" stroke="${color}" stroke-width="1.4"></line>
                <rect x="${x - candleWidth / 2}" y="${bodyTop}" width="${candleWidth}" height="${bodyHeight}" rx="3" fill="${color}"></rect>
            </g>
        `;
    }).join('');

    return `
        <svg viewBox="0 0 ${width} ${height}" width="100%" height="70" preserveAspectRatio="none">
            <rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="rgba(255,255,255,0.02)"></rect>
            ${candles}
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
marketCardsEl.addEventListener('click', handleSelectTicker);

initGame();

window.game = {
    data: () => gameData,
    engine: gameEngine,
    prices: prices
};