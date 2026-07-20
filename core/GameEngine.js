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
        
        // 3. Проверяем ежемесячные выплаты и события
        const monthlyEvents = { ...(gameData.monthlyEvents || {}) };
        const event = this.checkLifeEvents(newDay, { ...gameData, monthlyEvents });
        if (event && event.amount) {
            portfolio.cash += event.amount;
        }
        
        // 4. Сохраняем новое состояние
        const newGameData = {
            ...gameData,
            portfolio,
            currentDay: newDay,
            monthlyEvents,
            pendingEvent: event
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

    getMonthInfo(day) {
        const monthIndex = Math.floor((day - 1) / 30);
        const dayOfMonth = ((day - 1) % 30) + 1;
        return { monthIndex, dayOfMonth };
    }

    getRandomEventDay() {
        let eventDay;
        do {
            eventDay = Math.floor(Math.random() * 30) + 1;
        } while (eventDay === 10 || eventDay === 25);
        return eventDay;
    }

    /**
     * Проверить жизненные ситуации
     */
    checkLifeEvents(day, gameData) {
        const { monthIndex, dayOfMonth } = this.getMonthInfo(day);
        const monthlyEvents = gameData?.monthlyEvents || {};

        if (!monthlyEvents[monthIndex]) {
            monthlyEvents[monthIndex] = this.getRandomEventDay();
        }

        const eventDay = monthlyEvents[monthIndex];

        if (dayOfMonth === 10 || dayOfMonth === 25) {
            return {
                type: 'bonus',
                title: 'Ежемесячная выплата',
                text: 'На ваш счёт зачислено 10000 ₽.',
                amount: 10000,
                buttonText: 'Продолжить'
            };
        }

        if (dayOfMonth === eventDay) {
            const templates = [
                {
                    title: 'Случайное событие',
                    text: 'К вам пришёл неожиданный поворот в финансовой жизни. Проверьте состояние счёта.'
                },
                {
                    title: 'Внезапная возможность',
                    text: 'На рынке появился шанс, который стоит учитывать при следующем выборе.'
                },
                {
                    title: 'Нестандартная ситуация',
                    text: 'Ситуация требует быстрого решения и внимательного взгляда на портфель.'
                }
            ];

            const template = templates[(monthIndex + dayOfMonth) % templates.length];
            return {
                type: 'event',
                title: template.title,
                text: template.text,
                amount: 0,
                buttonText: 'Продолжить'
            };
        }

        return null;
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