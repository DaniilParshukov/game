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

        const bankAccount = this.getBankAccount(portfolio);
        const bankRate = bankAccount.balance < 0 ? 0.12 : 0.06;
        const dailyRate = bankRate / 365;
        bankAccount.balance += bankAccount.balance * dailyRate;
        this.setBankAccount(portfolio, bankAccount);

        portfolio.deposits = deposits;
        return portfolio;
    }

    getBankAccount(portfolio) {
        return portfolio.bankAccount || { balance: 0, rate: 0.06 };
    }

    setBankAccount(portfolio, account) {
        portfolio.bankAccount = account;
        return portfolio;
    }

    getInstrumentInfo(ticker) {
        if (ticker === 'BANK') {
            return {label: "Накопительный счет в банке", description: "Это счет в банке, который можно пополнять на любую сумму и снимать с него деньги на условиях банка. В игре – пополнять и снимать деньги можно каждый день на максимально доступные суммы.\nБанк выплачивает проценты на счет, как правило, на минимальный остаток на счете за период, один раз в месяц или в день по установленной ставке. В игре – проценты начисляются ежедневно. Процентная ставка 10% годовых. Например, если на начало дня на счете было 10000 рублей, потом на него с кошелька была переведена зарплата 10000 рублей, и в этот же день списаны 17000 рублей на покупку облигаций, то минимальный остаток в этот день на счете – 3000 рублей. За этот день процентный доход будет рассчитан: (3000*1*10)/(365*100)=0,82 рубля.\nОсновной риск для вкладчика банка в том, что банк не вернет деньги, которые лежат на счете. Это может произойти, если банк окажется банкротом и лишится лицензии. Если банк в РФ входит в систему страхования вкладов, то деньги вкладчика застрахованы на сумму 1,4 млн рублей.\nЧтобы выбрать банк, клиент смотрит на его надежность (размер банка и страховка), размер процентов как потенциальный доход, удобство обслуживания (сервисы и приложение), разнообразие банковских и финансовых продуктов (типы счетов, условия кредитов, возможность брокерского обслуживания и другое). Банковские продукты выбирают под собственные потребности и возможности с наивысшим процентом. Например, если есть возможность накопления, и не планируется тратить в ближайшее время, можно выбрать вклад только с возможностью пополнения – как правило, проценты по нему будут выше.\nРазмер процентной ставки банка в первую очередь определяется процентной ставкой центрального банка (в РФ это ключевая ставка Банка России). Процентная ставка зависит от общих экономических условий и состояния финансового рынка страны."};
        } else {
            return {label: ticker, description: `Информация о финансовом инструменте ${ticker}. В реальной игре здесь будет описание и характеристики инструмента.`};
        }
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
        const bankAccount = this.getBankAccount(portfolio);
        total += bankAccount.balance || 0;
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
            BANK: { label: 'Банковский счёт', rate: 0.06, term: 0, description: 'Счёт с мгновенным доступом к средствам' },
            OFZ: { label: 'ОФЗ', rate: 0.08, term: 90, description: 'Облигации федерального займа' },
            BONDS: { label: 'Корпоративные облигации', rate: 0.10, term: 180, description: 'Доходность 10% годовых' }
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
        if (productKey === 'BANK') {
            if (gameData.portfolio.cash < amount) {
                throw new Error(`Недостаточно средств. Нужно: ${amount}, есть: ${gameData.portfolio.cash}`);
            }
            gameData.portfolio.cash -= amount;
            const bankAccount = this.getBankAccount(gameData.portfolio);
            bankAccount.balance += amount;
            this.setBankAccount(gameData.portfolio, bankAccount);
        } else {
            if (gameData.portfolio.cash < amount) {
                throw new Error(`Недостаточно средств. Нужно: ${amount}, есть: ${gameData.portfolio.cash}`);
            }
            const depositState = gameData.portfolio.deposits || {};
            const activeDeposits = (depositState[productKey] || []).length;
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

    withdrawDeposit(gameData, productKey, index, amount = null) {
        if (productKey === 'BANK') {
            const bankAccount = this.getBankAccount(gameData.portfolio);
            const transferAmount = amount ?? bankAccount.balance;
            if (transferAmount <= 0) {
                throw new Error('Сумма снятия должна быть положительной');
            }
            if (bankAccount.balance < transferAmount) {
                throw new Error(`Недостаточно средств на счёте. Есть: ${bankAccount.balance}`);
            }
            bankAccount.balance -= transferAmount;
            this.setBankAccount(gameData.portfolio, bankAccount);
            gameData.portfolio.cash += transferAmount;
            gameData.history.push({
                type: 'BANK_WITHDRAW',
                productKey,
                amount: transferAmount,
                day: gameData.currentDay
            });
            return gameData;
        }

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
                text: 'Вы получили ежемесячную выплату.',
                amount: 10000,
                actionType: 'gain',
                buttonText: 'Получить 10000 ₽'
            };
        }

        if (dayOfMonth === eventDay) {
            const templates = [
                {
                    title: 'Случайное событие',
                    text: 'Пришлось оплатить ремонтные расходы.',
                    actionType: 'cost'
                },
                {
                    title: 'Внезапная возможность',
                    text: 'Вы нашли способ получить дополнительный доход.',
                    actionType: 'gain'
                },
                {
                    title: 'Нестандартная ситуация',
                    text: 'Нужно быстро решить, откуда взять деньги на срочные нужды.',
                    actionType: 'cost'
                }
            ];

            const template = templates[(monthIndex + dayOfMonth) % templates.length];
            const costAmount = 2500 + ((monthIndex + dayOfMonth) % 3) * 500;

            return {
                type: 'event',
                title: template.title,
                text: template.text,
                amount: costAmount,
                actionType: template.actionType,
                buttonText: template.actionType === 'gain' ? `Получить ${costAmount} ₽` : 'Выбрать способ'
            };
        }

        return null;
    }

    applyEventDecision(gameData, event, choice) {
        if (!event) {
            gameData.pendingEvent = null;
            return gameData;
        }

        const actionType = event.actionType || (event.amount > 0 ? 'gain' : 'info');
        const amount = Math.abs(event.amount || 0);

        if (actionType === 'gain') {
            if (choice !== 'receive') {
                throw new Error('Нужно подтвердить получение денег');
            }
            gameData.portfolio.cash += amount;
        } else if (actionType === 'cost') {
            if (choice === 'cash') {
                if (gameData.portfolio.cash < amount) {
                    throw new Error(`Недостаточно наличных. Нужно: ${amount} ₽`);
                }
                gameData.portfolio.cash -= amount;
            } else if (choice === 'BANK') {
                const bankAccount = this.getBankAccount(gameData.portfolio);
                bankAccount.balance -= amount;
                this.setBankAccount(gameData.portfolio, bankAccount);
            } else {
                throw new Error('Необходимо выбрать вариант');
            }
        }

        gameData.history.push({
            type: 'EVENT_DECISION',
            eventType: event.type,
            choice,
            amount,
            day: gameData.currentDay
        });
        gameData.pendingEvent = null;
        return gameData;
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