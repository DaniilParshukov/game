// script.js

import { GameEngine } from './core/GameEngine.js';
import { LocalStorageAdapter } from './storage/LocalStorageAdapter.js';
import { LocalPrices } from './prices/LocalPrices.js';

// 1. Создаём зависимости
const storage = new LocalStorageAdapter();
const prices = new LocalPrices();

// 2. Создаём движок игры
const gameEngine = new GameEngine(storage, prices);

// 3. Состояние игры
let gameData = null;
const GAME_ID = 'my_game';

// DOM-элементы
const balanceEl = document.getElementById('balance');
const dayEl = document.getElementById('day');
const portfolioEl = document.getElementById('portfolio');
const logEl = document.getElementById('log');
const nextDayBtn = document.getElementById('nextDay');
const buyBtn = document.getElementById('buy');
const sellBtn = document.getElementById('sell');
const resetBtn = document.getElementById('reset');

/**
 * Инициализация игры
 */
async function initGame() {
    // Пытаемся загрузить сохранённую игру
    let saved = await storage.loadGame(GAME_ID);
    
    if (saved) {
        gameData = saved;
        console.log('📂 Загружена сохранённая игра');
    } else {
        // Создаём новую игру
        gameData = createNewGame();
        await storage.saveGame(GAME_ID, gameData);
        console.log('🆕 Создана новая игра');
    }
    
    renderUI();
}

/**
 * Создать новую игру
 */
function createNewGame() {
    return {
        portfolio: {
            cash: 10000, // Подарок родителей
            assets: {}, // Пока пусто
            assetValues: {}
        },
        currentDay: 1,
        history: []
    };
}

/**
 * Перерисовать интерфейс
 */
function renderUI() {
    if (!gameData) return;
    
    const portfolio = gameData.portfolio;
    const total = gameEngine.getTotalValue(portfolio);
    
    // Обновляем баланс
    balanceEl.textContent = `💰 ${Math.round(total)} руб. (наличные: ${Math.round(portfolio.cash)} руб.)`;
    dayEl.textContent = `📅 День ${gameData.currentDay} из 365`;
    
    // Обновляем портфель
    renderPortfolio();
    
    // Обновляем лог
    renderLog();
}

/**
 * Отобразить портфель
 */
function renderPortfolio() {
    const portfolio = gameData.portfolio;
    const assetValues = portfolio.assetValues || {};
    
    if (Object.keys(assetValues).length === 0 && portfolio.cash > 0) {
        portfolioEl.innerHTML = `
            <div class="empty-portfolio">
                <p>У вас пока нет активов</p>
                <p style="font-size: 0.9rem; color: #666;">
                    💡 Попробуйте купить что-то в секции ниже
                </p>
            </div>
        `;
        return;
    }
    
    let html = '<table><tr><th>Актив</th><th>Кол-во</th><th>Цена</th><th>Стоимость</th></tr>';
    let totalAssets = 0;
    
    for (const [ticker, data] of Object.entries(assetValues)) {
        html += `
            <tr>
                <td><strong>${ticker}</strong></td>
                <td>${data.quantity}</td>
                <td>${data.price.toFixed(2)} руб.</td>
                <td>${data.value.toFixed(2)} руб.</td>
            </tr>
        `;
        totalAssets += data.value;
    }
    
    html += `
        <tr style="font-weight: bold; border-top: 2px solid #ccc;">
            <td colspan="3">Итого в активах:</td>
            <td>${totalAssets.toFixed(2)} руб.</td>
        </tr>
    </html>`;
    
    portfolioEl.innerHTML = html;
}

/**
 * Отобразить лог транзакций
 */
function renderLog() {
    const history = gameData.history || [];
    if (history.length === 0) {
        logEl.innerHTML = '<div class="empty-log">История операций пуста</div>';
        return;
    }
    
    const lastEvents = history.slice(-5).reverse();
    let html = '<h4>Последние операции:</h4><ul>';
    for (const event of lastEvents) {
        const sign = event.type === 'BUY' ? '🟢' : '🔴';
        html += `
            <li>
                ${sign} ${event.type} ${event.ticker} 
                ${event.amount} шт. по ${event.price.toFixed(2)} руб. 
                (${event.total.toFixed(2)} руб.)
            </li>
        `;
    }
    html += '</ul>';
    logEl.innerHTML = html;
}

/**
 * Обработка нажатия "Следующий день"
 */
async function handleNextDay() {
    if (gameData.currentDay >= 365) {
        alert('🎉 Игра завершена! Нажмите "Сбросить", чтобы начать заново');
        return;
    }
    
    // Прогоняем день через движок
    gameData = gameEngine.nextDay(gameData);
    
    // Сохраняем
    await storage.saveGame(GAME_ID, gameData);
    
    // Обновляем интерфейс
    renderUI();
    
    // Проверяем, не закончилась ли игра
    if (gameData.currentDay === 365) {
        showFinalResult();
    }
}

/**
 * Показать финальный результат
 */
function showFinalResult() {
    const recommendation = gameEngine.getRecommendation(gameData);
    const total = gameEngine.getTotalValue(gameData.portfolio);
    
    setTimeout(() => {
        alert(`
🎮 ИГРА ЗАВЕРШЕНА!

💰 Итоговая сумма: ${Math.round(total)} руб.
📈 Прибыль: ${Math.round(recommendation.profit)} руб. (${recommendation.percent.toFixed(1)}%)

${recommendation.text}
        `);
    }, 500);
}

/**
 * Купить актив
 */
async function handleBuy() {
    const ticker = document.getElementById('tickerInput').value.toUpperCase();
    const amount = parseInt(document.getElementById('amountInput').value);
    
    if (!ticker || !amount || amount <= 0) {
        alert('Введите тикер и количество');
        return;
    }
    
    try {
        const price = prices.getPrice(ticker, gameData.currentDay);
        const cost = price * amount;
        
        if (gameData.portfolio.cash < cost) {
            alert(`❌ Недостаточно средств! Нужно: ${cost.toFixed(2)} руб., есть: ${gameData.portfolio.cash.toFixed(2)} руб.`);
            return;
        }
        
        gameData = gameEngine.buyAsset(gameData, ticker, amount);
        await storage.saveGame(GAME_ID, gameData);
        renderUI();
        
        document.getElementById('tickerInput').value = '';
        document.getElementById('amountInput').value = '';
        
    } catch (error) {
        alert(`❌ Ошибка: ${error.message}`);
    }
}

/**
 * Продать актив
 */
async function handleSell() {
    const ticker = document.getElementById('tickerInput').value.toUpperCase();
    const amount = parseInt(document.getElementById('amountInput').value);
    
    if (!ticker || !amount || amount <= 0) {
        alert('Введите тикер и количество');
        return;
    }
    
    try {
        if (!gameData.portfolio.assets[ticker]) {
            alert(`❌ У вас нет актива ${ticker}`);
            return;
        }
        
        if (gameData.portfolio.assets[ticker] < amount) {
            alert(`❌ У вас только ${gameData.portfolio.assets[ticker]} акций ${ticker}`);
            return;
        }
        
        gameData = gameEngine.sellAsset(gameData, ticker, amount);
        await storage.saveGame(GAME_ID, gameData);
        renderUI();
        
        document.getElementById('tickerInput').value = '';
        document.getElementById('amountInput').value = '';
        
    } catch (error) {
        alert(`❌ Ошибка: ${error.message}`);
    }
}

/**
 * Сброс игры
 */
async function handleReset() {
    if (confirm('Вы уверены? Вся игра будет сброшена!')) {
        await storage.deleteGame(GAME_ID);
        gameData = createNewGame();
        await storage.saveGame(GAME_ID, gameData);
        renderUI();
    }
}

// 6. Навешиваем обработчики
nextDayBtn.addEventListener('click', handleNextDay);
buyBtn.addEventListener('click', handleBuy);
sellBtn.addEventListener('click', handleSell);
resetBtn.addEventListener('click', handleReset);

// 7. Запускаем игру
initGame();

// Глобально доступные переменные для отладки
window.game = {
    data: () => gameData,
    engine: gameEngine,
    prices: prices
};