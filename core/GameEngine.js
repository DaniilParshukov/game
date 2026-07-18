// core/GameEngine.js

export class GameEngine {
    /**
     * @param {IStorage} storage - Хранилище
     * @param {IPrices} prices - Источник цен
     */
    constructor(storage, prices) {
        this.storage = storage;
        this.prices = prices;
    }

    /**
     * Начислить проценты на остаток
     */
    applyInterest(portfolio) {
        const rate = 0.11; // 11% годовых
        const dailyRate = rate / 365;
        const interest = portfolio.cash * dailyRate;
        portfolio.cash += interest;
        return portfolio;
    }

    /**
     * Переоценить активы по текущим ценам
     */
    revaluateAssets(portfolio, day) {
        const updatedAssets = {};
        for (const [ticker, quantity] of Object.entries(portfolio.assets)) {
            const price = this.prices.getPrice(ticker, day);
            updatedAssets[ticker] = {
                quantity,
                price,
                value: quantity * price
            };
        }
        portfolio.assetValues = updatedAssets;
        return portfolio;
    }

    /**
     * Рассчитать общую стоимость портфеля
     */
    getTotalValue(portfolio) {
        let total = portfolio.cash;
        for (const [ticker, data] of Object.entries(portfolio.assetValues || {})) {
            total += data.value;
        }
        return total;
    }

    /**
     * Перейти к следующему дню
     */
    nextDay(gameData) {
        const newDay = gameData.currentDay + 1;
        
        // 1. Начисляем проценты
        let portfolio = this.applyInterest(gameData.portfolio);
        
        // 2. Переоцениваем активы
        portfolio = this.revaluateAssets(portfolio, newDay);
        
        // 3. Проверяем жизненные ситуации (пока заглушка)
        const event = this.checkLifeEvents(newDay);
        if (event) {
            portfolio.cash += event.amount;
        }
        
        // 4. Сохраняем новое состояние
        const newGameData = {
            ...gameData,
            portfolio,
            currentDay: newDay
        };
        
        return newGameData;
    }

    /**
     * Купить актив
     */
    buyAsset(gameData, ticker, amount) {
        const day = gameData.currentDay;
        const price = this.prices.getPrice(ticker, day);
        const cost = price * amount;
        
        if (gameData.portfolio.cash < cost) {
            throw new Error(`Недостаточно средств. Нужно: ${cost}, есть: ${gameData.portfolio.cash}`);
        }
        
        // Списываем деньги
        gameData.portfolio.cash -= cost;
        
        // Добавляем актив
        if (!gameData.portfolio.assets[ticker]) {
            gameData.portfolio.assets[ticker] = 0;
        }
        gameData.portfolio.assets[ticker] += amount;
        
        // Записываем транзакцию
        gameData.history.push({
            type: 'BUY',
            ticker,
            amount,
            price,
            total: cost,
            day
        });
        
        // Переоцениваем портфель
        gameData.portfolio = this.revaluateAssets(gameData.portfolio, day);
        
        return gameData;
    }

    /**
     * Продать актив
     */
    sellAsset(gameData, ticker, amount) {
        const day = gameData.currentDay;
        const price = this.prices.getPrice(ticker, day);
        const revenue = price * amount;
        
        if (!gameData.portfolio.assets[ticker]) {
            throw new Error(`У вас нет актива ${ticker}`);
        }
        
        if (gameData.portfolio.assets[ticker] < amount) {
            throw new Error(`У вас только ${gameData.portfolio.assets[ticker]} акций ${ticker}`);
        }
        
        // Уменьшаем количество
        gameData.portfolio.assets[ticker] -= amount;
        
        // Если стало 0, удаляем из портфеля
        if (gameData.portfolio.assets[ticker] === 0) {
            delete gameData.portfolio.assets[ticker];
        }
        
        // Добавляем деньги
        gameData.portfolio.cash += revenue;
        
        // Записываем транзакцию
        gameData.history.push({
            type: 'SELL',
            ticker,
            amount,
            price,
            total: revenue,
            day
        });
        
        // Переоцениваем портфель
        gameData.portfolio = this.revaluateAssets(gameData.portfolio, day);
        
        return gameData;
    }

    /**
     * Проверить жизненные ситуации
     */
    checkLifeEvents(day) {
        // Пока простые заглушки
        const events = {
            30: { amount: 5000, description: 'Премия на работе!' },
            100: { amount: -3000, description: 'Сломался телефон, пришлось купить новый' },
            200: { amount: 10000, description: 'Выиграл в лотерею!' },
            300: { amount: -5000, description: 'Налог на имущество' }
        };
        
        return events[day] || null;
    }

    /**
     * Получить итоговую рекомендацию
     */
    getRecommendation(gameData) {
        const initialCapital = 250000; // 10 000 (подарок) + 20 000 * 12 месяцев
        const finalCapital = this.getTotalValue(gameData.portfolio);
        const profit = finalCapital - initialCapital;
        const percent = (profit / initialCapital) * 100;
        
        if (profit > 20000) {
            return {
                type: 'success',
                text: 'Молодцом! Твои инвестиционные идеи были успешны! 🎉',
                profit,
                percent
            };
        } else if (profit > 0) {
            return {
                type: 'moderate',
                text: 'Пока тебе лучше инвестировать в низкорисковые активы, например, в ОФЗ',
                profit,
                percent
            };
        } else {
            return {
                type: 'fail',
                text: 'Наверное, тебе лучше вкладывать деньги в надежный банк под стабильный процент',
                profit,
                percent
            };
        }
    }
}