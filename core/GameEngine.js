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
        return portfolio;
    }

    /**
     * Начислить проценты по депозитам
     */
    applyDepositInterest(portfolio, day) {
        const deposits = portfolio.deposits || {};
        for (const [productKey, positions] of Object.entries(deposits)) {
            if (!Array.isArray(positions)) continue;
            for (const deposit of positions) {
                if (!deposit || !deposit.amount) continue;
                const dailyRate = (deposit.rate || 0) / 365;
                deposit.amount += deposit.amount * dailyRate;
                deposit.termDays = Math.max(0, (deposit.termDays ?? 180) - 1);
                deposit.lastProcessedDay = day;
            }
        }
        portfolio.deposits = deposits;
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
        let total = portfolio.cash || 0;
        for (const [ticker, data] of Object.entries(portfolio.assetValues || {})) {
            total += data.value || 0;
        }
        for (const positions of Object.values(portfolio.deposits || {})) {
            if (!Array.isArray(positions)) continue;
            for (const deposit of positions) {
                total += deposit.amount || 0;
            }
        }
        return total;
    }

    /**
     * Перейти к следующему дню
     */
    nextDay(gameData) {
        const newDay = gameData.currentDay + 1;
        
        // 1. Начисляем проценты по депозитам
        let portfolio = this.applyDepositInterest(gameData.portfolio, newDay);

        // 3. Переоцениваем активы
        portfolio = this.revaluateAssets(portfolio, newDay);
        
        // 4. Проверяем ежемесячные выплаты и события
        const monthlyEvents = { ...(gameData.monthlyEvents || {}) };
        const event = this.checkLifeEvents(newDay, { ...gameData, monthlyEvents });
        if (event && event.amount) {
            portfolio.cash += event.amount;
        }
        
        // 5. Сохраняем новое состояние
        const newGameData = {
            ...gameData,
            portfolio,
            currentDay: newDay,
            monthlyEvents,
            pendingEvent: event
        };
        
        return newGameData;
    }

    getDepositConfig(productKey) {
        const configs = {
            bank: { label: 'Банковский счёт', rate: 0.06, term: 0, description: 'Счёт с мгновенным доступом к средствам' },
            ofz: { label: 'ОФЗ', rate: 0.08, term: 90, description: 'Облигации федерального займа' },
            bonds: { label: 'Корпоративные облигации', rate: 0.10, term: 180, description: 'Доходность 10% годовых' }
        };
        return configs[productKey] || null;
    }

    openDeposit(gameData, productKey, amount) {
        const config = this.getDepositConfig(productKey);
        if (!config) {
            throw new Error(`Неверный продукт: ${productKey}`);
        }
        if (!amount || amount <= 0) {
            throw new Error('Введите сумму вклада');
        }
        if (gameData.portfolio.cash < amount) {
            throw new Error(`Недостаточно средств. Нужно: ${amount}, есть: ${gameData.portfolio.cash}`);
        }

        if (productKey !== 'bank') {
            const depositState = gameData.portfolio.deposits || {};
            const activeDeposits = [productKey].reduce((sum, key) => sum + ((depositState[key] || []).length || 0), 0);
            if (activeDeposits >= 3) {
                throw new Error('Можно открыть не больше 3 вкладов');
            }
            depositState[productKey] = Array.isArray(depositState[productKey]) ? depositState[productKey] : [];
            depositState[productKey].push({
                amount,
                openedDay: gameData.currentDay,
                maturityDay: gameData.currentDay + (config.term || 180),
                rate: config.rate,
                productKey,
                termDays: config.term || 180
            });
            gameData.portfolio.deposits = depositState;
        } else {
            gameData.portfolio.cash -= amount;
        }

        gameData.history.push({
            type: 'DEPOSIT_OPEN',
            productKey,
            amount,
            rate: config.rate,
            day: gameData.currentDay
        });
        return gameData;
    }

    withdrawDeposit(gameData, productKey, index) {
        const depositState = gameData.portfolio.deposits || {};
        const positions = depositState[productKey];
        const deposit = Array.isArray(positions) ? positions[index] : null;
        if (!deposit) {
            throw new Error('У вас нет такого вклада');
        }
        if ((deposit.termDays ?? 0) > 0) {
            throw new Error(`Снятие доступно через ${deposit.termDays} дней`);
        }

        gameData.portfolio.cash += deposit.amount;
        positions.splice(index, 1);
        gameData.history.push({
            type: 'DEPOSIT_WITHDRAW',
            productKey,
            amount: deposit.amount,
            day: gameData.currentDay
        });
        return gameData;
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