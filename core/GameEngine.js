export class GameEngine {
    /**
     * @param {IStorage} storage - Хранилище
     * @param {IPrices} prices - Источник цен
     */
    constructor(storage, prices) {
        this.storage = storage;
        this.prices = prices;
        this.goodEvents = [
            {
                icon: '🎁',
                title: 'Бабушка подарила лотерейный билет, по которому пришел выигрыш!',
                text: 'Неожиданный доход пополнил ваш бюджет.',
                amount: 5000
            },
            {
                icon: '🏆',
                title: 'За прошлый месяц компания выплатила премию по результатам работы.',
                text: 'Премия увеличила твои свободные средства.',
                amount: 10000
            },
            {
                icon: '🎂',
                title: 'Тетушка прислала перевод на день рождения в этом году подарок пришел неожиданно.',
                text: 'Подарок поступил в твой бюджет.',
                amount: 3000
            },
            {
                icon: '💸',
                title: 'Друг проспорил торт, но ты попросил отдать выигрыш деньгами.',
                text: 'Спор принес небольшой денежный бонус.',
                amount: 1000
            },
            {
                icon: '🔧',
                title: 'Помог разобрать старый сарай на даче и сдал получившийся металлолом.',
                text: 'Неожиданный заработок пополнил бюджет.',
                amount: 30000
            },
            {
                icon: '🏅',
                title: 'За победу в конкурсе по финансовой грамотности тебе выплатили приз.',
                text: 'Знания о финансах принесли денежную награду.',
                amount: 10000
            },
            {
                icon: '🎮',
                title: 'Ты случайно попал на промоакцию игровой приставки и выиграл денежный приз.',
                text: 'Удача принесла дополнительные деньги.',
                amount: 2000
            },
            {
                icon: '📷',
                title: 'На концерте фотографу понадобилась твоя камера Canon PowerShot.',
                text: 'За аренду камеры тебе заплатили.',
                amount: 5000
            },
            {
                icon: '📸',
                title: 'Твоя фотография о дикой природе получила первый приз на фотовыставке.',
                text: 'Творческая работа принесла денежный приз.',
                amount: 10000
            },
            {
                icon: '💳',
                title: 'Банк начислил кэшбек за прошедший месяц по твоим покупкам.',
                text: 'Кэшбек вернулся на твой счет.',
                amount: 2500
            },
            {
                icon: '🧥',
                title: 'В кармане зимнего пуховика нашлась забытая купюра.',
                text: 'Приятная находка увеличила бюджет.',
                amount: 2000
            },
            {
                icon: '🎧',
                title: 'На день рождения подарили двое одинаковых наушников. Одни удалось продать на Авито.',
                text: 'Продажа ненужного подарка принесла деньги',
                amount: 7600
            },
            {
                icon: '✍️',
                title: 'На концерте удалось получить два автографа. Один продан в соцсетях.',
                text: 'Редкий сувенир оказался востребованным.',
                amount: 20000
            },
            {
                icon: '💼',
                title: 'Начальник поручил подготовить презентацию по проекту и выписал премию.',
                text: 'Дополнительная работа принесла премию.',
                amount: 3000
            },
            {
                icon: '🐱',
                title: 'Твой кот получил приз зрительских симпатий на выставке котов.',
                text: 'К премии добавились 2 кг корма для кота.',
                amount: 5000
            }
        ];

        this.badEvents = [
            {
                icon: '🛡️',
                title: 'Нужно срочно оформить страховку от укуса клеща.',
                text: 'Деньги списаны из бюджета.',
                amount: -1000
            },
            {
                icon: '🩻',
                title: 'На пробежке ты поскользнулся. Нужно срочно сделать рентген без медицинской страховки.',
                text: 'Срочная диагностика потребовала расходов.',
                amount: -1500
            },
            {
                icon: '💊',
                title: 'Бабушке срочно нужно привезти лекарство, которое выписал терапевт.',
                text: 'Лекарство пришлось купить за свои деньги.',
                amount: -1200
            },
            {
                icon: '🐾',
                title: 'Коту не хватает витаминов. Ветеринар назначил таблетки с таурином.',
                text: 'Покупка назначенных ветеринаром таблеток.',
                amount: -500
            },
            {
                icon: '🐱',
                title: 'Кот испортил диван. Срочно нужно постричь ему когти.',
                text: 'Незапланированный уход за питомцем.',
                amount: -1000
            },
            {
                icon: '🚦',
                title: 'За переход дороги вне зоны пешеходного перехода сотрудник ГИБДД выписал штраф.',
                text: 'Штраф уменьшил свободные средства.',
                amount: -1000
            },
            {
                icon: '🎁',
                title: 'У подруги день рождения. Нужно срочно купить подарок.',
                text: 'Праздничный подарок немного уменьшил твой бюджет.',
                amount: -3000
            },
            {
                icon: '💍',
                title: 'Идешь к друзьям на свадьбу. Нужно подготовить подарок.',
                text: 'Подарок на свадьбу заметно уменьшил бюджет.',
                amount: -10000
            },
            {
                icon: '🏠',
                title: 'Ты живешь у друга месяц на время ремонта. Нужно оплатить коммунальные расходы.',
                text: 'Коммунальные платежи пришлось взять на себя.',
                amount: -2500
            },
            {
                icon: '💳',
                title: 'Ты забыл отказаться от платной подписки и в этом месяце списались деньги.',
                text: 'Неожиданное списание уменьшило бюджет.',
                amount: -1600
            },
            {
                icon: '☔',
                title: 'Весь день идет дождь, а зонта нет. Рядом только магазин.',
                text: 'Пришлось срочно купить зонт.',
                amount: -6500
            },
            {
                icon: '⚡',
                title: 'Во время грозы молния вывела из строя зарядное устройство от ноутбука.',
                text: 'Электронику пришлось срочно заменить.',
                amount: -6500
            },
            {
                icon: '♨️',
                title: 'Опаздываешь на поезд. Успеть можно только на такси.',
                text: 'Срочная поездка добавила расход.',
                amount: -4000
            },
            {
                icon: '🚕',
                title: 'Опаздываешь на поезд. Успеть можно только на такси.',
                text: 'Срочная поездка добавила расход.',
                amount: -500
            },
            {
                icon: '📱',
                title: 'Телефон упал в воду и перестал работать. Придется покупать новый Android.',
                text: 'Поломка телефона стала крупной незапланированной тратой.',
                amount: -15000
            }
        ];
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
    applyBankInterest(portfolio, date) {
        if (!portfolio || !this.prices || typeof this.prices.getPrice !== 'function') {
            return;
        }

        const safeDate = date instanceof Date ? new Date(date) : new Date(String(date));
        if (Number.isNaN(safeDate.getTime())) {
            return;
        }

        const currentBalance = Number(portfolio.bankBalance) || 0;
        const rawRate = Number(this.prices.getPrice('BANK', safeDate));
        if (!Number.isFinite(rawRate) || rawRate <= 0) {
            return;
        }

        const bankRate = currentBalance < 0 ? rawRate * 2 : rawRate;
        const dailyRate = bankRate / 365;
        portfolio.bankBalance = currentBalance + (currentBalance * dailyRate / 100);
    }

    applyAssetDatePayments(gameData) {
        const portfolio = gameData?.portfolio;
        const date = gameData?.date;

        if (!portfolio || !portfolio.assets || !date || !this.prices || typeof this.prices.getValueByDate !== 'function') {
            return;
        }

        for (const [ticker, quantity] of Object.entries(portfolio.assets)) {
            let payoutValue = 0;

            payoutValue = Number(this.prices.getValueByDate(ticker, date));

            if (payoutValue == 0) continue;

            if (!Number.isFinite(payoutValue) || payoutValue < 0) {
                console.warn(`Неверное значение выплаты для тикера ${ticker} на дату ${date.toISOString()}: ${payoutValue}`);
                continue;
            }

            const amount = payoutValue * Number(quantity);
            if (amount <= 0) {
                continue;
            }

            portfolio.cash += amount;
            gameData.history.push({
                type: 'ASSET_PAYOUT',
                ticker,
                quantity,
                payoutValue,
                amount,
                date: new Date(date)
            });
        }
    }

    /**
     * Переоценить активы по текущим ценам
     */
    revaluateAssets(portfolio, date) {
        const safeDate = date instanceof Date ? new Date(date) : new Date(String(date));
        if (Number.isNaN(safeDate.getTime())) {
            return;
        }

        for (const [ticker, quantity] of Object.entries(portfolio.assets || {})) {
            const price = Number(this.prices.getPrice(ticker, safeDate));
            portfolio.assetValues = portfolio.assetValues || {};
            portfolio.assetValues[ticker] = {
                quantity: Number(quantity) || 0,
                price,
                value: (Number(quantity) || 0) * price
            };
        }
    }

    /**
     * Рассчитать общую стоимость портфеля
     */
    getTotalValue(portfolio) {
        if (!portfolio) return 0;

        let total = Number(portfolio.cash) || 0;
        total += Number(portfolio.bankBalance) || 0;
        for (const [ticker, data] of Object.entries(portfolio.assetValues || {})) {
            total += Number(data?.value) || 0;
        }
        return total;
    }


    nextDay(gameData) {
        const safeDate = gameData.date instanceof Date ? new Date(gameData.date) : new Date(String(gameData.date));
        if (Number.isNaN(safeDate.getTime())) {
            throw new Error('Некорректная дата игры для перехода на следующий день');
        }
        safeDate.setDate(safeDate.getDate() + 1);
        gameData.date = safeDate;

        this.applyBankInterest(gameData.portfolio, gameData.date);
        this.revaluateAssets(gameData.portfolio, gameData.date);
        this.applyAssetDatePayments(gameData);

        if (!gameData.monthlyEvents) {
            gameData.monthlyEvents = {};
        }

        this.checkSalary(gameData);
        gameData.pendingEvent = this.checkLifeEvents(gameData);
        return gameData;
    }

    openBank(gameData, amount) {
        const numericAmount = Number(amount) || 0;
        if (numericAmount <= 0) {
            throw new Error('Сумма пополнения должна быть положительной');
        }
        if ((Number(gameData.portfolio.cash) || 0) < numericAmount) {
            throw new Error(`Недостаточно средств. Нужно: ${numericAmount}, есть: ${Number(gameData.portfolio.cash) || 0}`);
        }
        gameData.portfolio.cash -= numericAmount;
        gameData.portfolio.bankBalance = (Number(gameData.portfolio.bankBalance) || 0) + numericAmount;

        gameData.history.push({
            type: 'BANK_OPEN',
            amount: numericAmount,
            date: new Date(gameData.date)
        });
        return gameData;
    }

    withdrawBank(gameData, amount) {
        const numericAmount = Number(amount) || 0;
        if (numericAmount <= 0) {
            throw new Error('Сумма снятия должна быть положительной');
        }
        if ((Number(gameData.portfolio.bankBalance) || 0) < numericAmount) {
            throw new Error(`Недостаточно средств на счёте. Есть: ${Number(gameData.portfolio.bankBalance) || 0}`);
        }
        gameData.portfolio.bankBalance -= numericAmount;
        gameData.portfolio.cash += numericAmount;
        gameData.history.push({
            type: 'BANK_WITHDRAW',
            amount: numericAmount,
            date: new Date(gameData.date)
        });
        return gameData;
    }

    buyAsset(gameData, ticker, amount) {
        const safeAmount = Number(amount) || 0;
        if (safeAmount <= 0) {
            throw new Error('Количество должно быть положительным');
        }

        const date = gameData.date instanceof Date ? new Date(gameData.date) : new Date(String(gameData.date));
        if (Number.isNaN(date.getTime())) {
            throw new Error('Некорректная дата игры');
        }

        const price = Number(this.prices.getPrice(ticker, date));
        const cost = price * safeAmount;
        
        if ((Number(gameData.portfolio.cash) || 0) < cost) {
            throw new Error(`Недостаточно средств. Нужно: ${cost}, есть: ${Number(gameData.portfolio.cash) || 0}`);
        }
        
        gameData.portfolio.cash -= cost;
        
        if (!gameData.portfolio.assets[ticker]) {
            gameData.portfolio.assets[ticker] = 0;
        }
        gameData.portfolio.assets[ticker] += safeAmount;
        
        gameData.history.push({
            type: 'BUY',
            ticker,
            amount: safeAmount,
            price,
            total: cost,
            date: new Date(date)
        });
        
        this.revaluateAssets(gameData.portfolio, date);

        return gameData;
    }

    sellAsset(gameData, ticker, amount) {
        const safeAmount = Number(amount) || 0;
        if (safeAmount <= 0) {
            throw new Error('Количество должно быть положительным');
        }

        const date = gameData.date instanceof Date ? new Date(gameData.date) : new Date(String(gameData.date));
        if (Number.isNaN(date.getTime())) {
            throw new Error('Некорректная дата игры');
        }

        const price = Number(this.prices.getPrice(ticker, date));
        const revenue = price * safeAmount;
        
        if (!gameData.portfolio.assets[ticker]) {
            throw new Error(`У вас нет актива ${ticker}`);
        }
        
        if ((Number(gameData.portfolio.assets[ticker]) || 0) < safeAmount) {
            throw new Error(`У вас только ${Number(gameData.portfolio.assets[ticker]) || 0} акций ${ticker}`);
        }
        
        gameData.portfolio.assets[ticker] -= safeAmount;
        
        if (gameData.portfolio.assets[ticker] === 0) {
            delete gameData.portfolio.assets[ticker];
        }
        
        gameData.portfolio.cash += revenue;
        
        gameData.history.push({
            type: 'SELL',
            ticker,
            amount: safeAmount,
            price,
            total: revenue,
            date: new Date(date)
        });
        
        this.revaluateAssets(gameData.portfolio, date);
        
        return gameData;
    }

    checkSalary(gameData) {
        const day = gameData.date.getDate();
        if (day === 10 || day === 25) {
            gameData.portfolio.cash += 10000;
        }
    }

    getRandomEventDay() {
        let eventDay;
        do {
            eventDay = Math.floor(Math.random() * 28) + 3;
        } while (eventDay === 10 || eventDay === 25 || eventDay === 15 || eventDay === 20);
        return eventDay;
    }

    /**
     * Проверить жизненные ситуации
     */
    createRandomEvent() {
        const isGood = Math.random() < 0.5;

        const eventPool = isGood ? this.goodEvents : this.badEvents;
        const randomIndex = Math.floor(Math.random() * eventPool.length);
        const selectedEvent = eventPool[randomIndex];

        return {
            type: 'event',
            icon: selectedEvent.icon,
            title: selectedEvent.title,
            text: selectedEvent.text,
            amount: selectedEvent.amount,
            buttonText: isGood ? `ОТЛИЧНО!` : 'ПОНЯТНО!',
            testMode: true
        };
    }

    checkLifeEvents(gameData) {
        const monthlyEvents = gameData?.monthlyEvents || {};

        let current = (gameData.date.getMonth() + 4) % 12 - 6; // magic

        if (current < 0) return null;

        if (!gameData._quarterEventsInit) {
            gameData._quarterEventsInit = true;
            gameData._quarterEvents = {};
            gameData._quarterTypes = {};

            const types = ['good', 'good', 'good', 'bad', 'bad', 'bad'];
            
            for (let i = types.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [types[i], types[j]] = [types[j], types[i]];
            }

            const quarters = [2, 3, 4, 5, 6, 7]; // март, апрель, май, июнь, июль, август
            for (let q = 0; q < quarters.length; q++) {
                const eventMonth = quarters[q];
                const eventDay = this.getRandomEventDay();
                
                gameData._quarterEvents[q] = { date: new Date(gameData.date.getFullYear(), eventMonth, eventDay) };
                gameData._quarterTypes[q] = types[q]; // good или bad
            }
        }

        const eventInfo = gameData._quarterEvents[current];
        
        if (eventInfo && gameData.date.getDate() === eventInfo.date.getDate() && gameData.date.getMonth() === eventInfo.date.getMonth()) {
            const isGood = gameData._quarterTypes[current] === 'good';
            

            // Выбираем случайное событие из соответствующего списка
            const eventPool = isGood ? this.goodEvents : this.badEvents;
            const randomIndex = Math.floor(Math.random() * eventPool.length);
            const selectedEvent = eventPool[randomIndex];

            return {
                type: 'event',
                icon: selectedEvent.icon,
                title: selectedEvent.title,
                text: selectedEvent.text,
                amount: selectedEvent.amount,
                buttonText: isGood ? `ОТЛИЧНО!` : 'ПОНЯТНО!',
            };
        }

        return null;
    }

    changeCash(gameData, amount) {
        const numericAmount = Number(amount) || 0;
        gameData.portfolio.cash += numericAmount;
        gameData.history.push({
            type: 'CASH_CHANGE',
            amount: numericAmount,
            day: new Date(gameData.date)
        });
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