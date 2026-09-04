(() => {
    const assetCards = document.querySelectorAll('.asset-card');
    const toggleSwitch = document.getElementById('toggleSwitch');
    const buyOption = toggleSwitch ? toggleSwitch.querySelector('.option[data-value="buy"]') : null;
    const sellOption = toggleSwitch ? toggleSwitch.querySelector('.option[data-value="sell"]') : null;
    const selectedAssetName = document.getElementById('selectedAssetName');
    const quantityLabel = document.getElementById('quantityLabel');
    const unitLabel = document.getElementById('unitLabel');
    const quantityInput = document.getElementById('quantityInput');
    const totalAmount = document.getElementById('totalAmount');
    const buyBtn = document.getElementById('buyBtn');
    const sellBtn = document.getElementById('sellBtn');

    let currentAsset = 'account';
    let currentAction = 'buy';
    let currentBond = 0;
    let currentStock = 0;
    let currentPif = 0;

    const assetData = {
        account: { label: 'Накопительный счет', quantityLabel: 'Сумма к пополнению/снятию', price: -1, infoId: 'accountInfo' },
        bonds: { label: 'ОФЗ', quantityLabel: 'Количество', price: -1, infoId: 'bondsSelection' },
        pif: { label: 'ПИФ1', quantityLabel: 'Количество', price: -1, infoId: 'pifSelection' },
        stocks: { label: 'Акция1', quantityLabel: 'Количество', price: -1, infoId: 'stocksSelection' },
        currency: { label: 'USD', quantityLabel: 'Количество', price: -1, infoId: 'currencyInfo' },
        gold: { label: 'Золото', quantityLabel: 'Количество', price: -1, infoId: 'goldInfo' }
    };

    const LOCAL_DEFAULT_STATE = {
        selectedTickers: {
            bonds: [],
            stocks: [],
            fundTickers: [],
            usdTicker: 'USD',
            goldTicker: 'GOLD',
            bankTicker: 'BANK'
        },
        portfolio: {
            cash: 0,
            bankAccount: { balance: 0 },
            assets: {},
            assetValues: {}
        },
        currentDay: 1
    };

    function readGameState() {
        try {
            const liveState = window.game && typeof window.game.data === 'function' ? window.game.data() : null;
            if (liveState) return liveState;

            if (window.game && typeof window.game.initialize === 'function') {
                // kick off initialize in background, update UI when ready
                void window.game.initialize().then(() => {
                    try { updateUI(); } catch (e) { console.log(e) }
                }).catch(() => {});
            }

            return LOCAL_DEFAULT_STATE;
        } catch (err) {
            console.warn('Не удалось прочитать состояние игры', err);
            return LOCAL_DEFAULT_STATE;
        }
    }

    function safeNumber(value) {
        return Number.isFinite(Number(value)) ? Number(value) : 0;
    }

    function formatMoney(value) {
        return `${Math.round(safeNumber(value)).toLocaleString('ru-RU')} ₽`;
    }

    function resolveTickerByAsset() {
        const state = readGameState();
        const selected = state?.selectedTickers || LOCAL_DEFAULT_STATE.selectedTickers;
        const others = Array.isArray(selected.others) ? selected.others : [];
        const fundTickers = Array.isArray(selected.fundTickers)
            ? selected.fundTickers
            : others.filter((t) => !/USD|GOLD|BANK/i.test(String(t))).slice(0, 2);
        const usdTicker = selected.usdTicker || others.find((t) => /USD/i.test(String(t))) || 'USD';
        const goldTicker = selected.goldTicker || others.find((t) => /GLD|GOLD|GLDRUB/i.test(String(t))) || 'GLDRUB_TOM';

        if (currentAsset === 'account') return selected.bankTicker || LOCAL_DEFAULT_STATE.selectedTickers.bankTicker;
        if (currentAsset === 'bonds') return (Array.isArray(selected.bonds) ? selected.bonds[currentBond] : undefined) || null;
        if (currentAsset === 'stocks') return (Array.isArray(selected.stocks) ? selected.stocks[currentStock] : undefined) || null;
        if (currentAsset === 'pif') return (Array.isArray(selected.fundTickers) ? selected.fundTickers[currentPif] : undefined) || null;
        if (currentAsset === 'currency') return usdTicker;
        if (currentAsset === 'gold') return goldTicker;
        throw new Error("Неизвестный актив: " + currentAsset);
    }

    function syncSelectedAssetNames() {
        const state = readGameState();
        const selected = state?.selectedTickers || LOCAL_DEFAULT_STATE.selectedTickers;
        const prices = window.game && typeof window.game.getPrices === 'function' ? window.game.getPrices() : null;

        const usdTicker = selected.usdTicker;
        const goldTicker = selected.goldTicker;

        const fundList = Array.isArray(selected.fundTickers) ? selected.fundTickers : LOCAL_DEFAULT_STATE.selectedTickers.fundTickers;
        const bondList = Array.isArray(selected.bonds) ? selected.bonds : LOCAL_DEFAULT_STATE.selectedTickers.bonds;
        const stockList = Array.isArray(selected.stocks) ? selected.stocks : LOCAL_DEFAULT_STATE.selectedTickers.stocks;

        if (bondList && bondList.length) {
            currentBond = Math.min(currentBond, bondList.length - 1);
            const bondTicker = bondList[currentBond];
            assetData.bonds.label = bondTicker || '—';
            assetData.bonds.price = (prices && typeof prices.getPrice === 'function' && bondTicker)
                ? Number(prices.getPrice(bondTicker, state.currentDay) || -1)
                : -1;
        } else {
            assetData.bonds.label = '—';
            assetData.bonds.price = -1;
        }

        if (stockList && stockList.length) {
            currentStock = Math.min(currentStock, stockList.length - 1);
            const stockTicker = stockList[currentStock];
            assetData.stocks.label = stockTicker || '—';
            assetData.stocks.price = (prices && typeof prices.getPrice === 'function' && stockTicker)
                ? Number(prices.getPrice(stockTicker, state.currentDay) || -1)
                : -1;
        } else {
            assetData.stocks.label = '—';
            assetData.stocks.price = -1;
        }

        if (fundList && fundList.length) {
            currentPif = Math.min(currentPif, fundList.length - 1);
            const pifTicker = fundList[currentPif];
            assetData.pif.label = pifTicker || '—';
            assetData.pif.price = (prices && typeof prices.getPrice === 'function' && pifTicker)
                ? Number(prices.getPrice(pifTicker, state.currentDay) || -1)
                : -1;
        } else {
            assetData.pif.label = '—';
            assetData.pif.price = -1;
        }

        assetData.currency.price = (prices && typeof prices.getPrice === 'function' && usdTicker)
            ? Number(prices.getPrice(usdTicker, state.currentDay) || -1)
            : -1;
        assetData.gold.price = (prices && typeof prices.getPrice === 'function' && goldTicker)
            ? Number(prices.getPrice(goldTicker, state.currentDay) || -1)
            : -1;

        // --- update DOM price labels in the HTML ---
        function fmtPrice(value, kind) {
            if (!Number.isFinite(Number(value)) || Number(value) < 0) return '—';
            if (kind === 'stock') return `${Math.round(Number(value)).toLocaleString('ru-RU')} ₽ / акция`;
            if (kind === 'pif') return `${Math.round(Number(value)).toLocaleString('ru-RU')} руб. за пай`;
            if (kind === 'currency') return `${Number(value).toFixed(2).replace('.', ',')} руб. / 1 USD`;
            // bond or gold or default
            return `${Math.round(Number(value)).toLocaleString('ru-RU')} руб.`;
        }
        // bonds selection items
        const bondElems = Array.from(document.querySelectorAll('#bondsSelection .selection-item'));
        bondElems.forEach((el, idx) => {
            const priceSpan = el.querySelector('.price');
            const priceVal = (Array.isArray(bondList) && bondList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(bondList[idx], state.currentDay) || -1) : -1) : -1;
            if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'bond');
        });

        // stocks selection items
        const stockElems = Array.from(document.querySelectorAll('#stocksSelection .selection-item'));
        stockElems.forEach((el, idx) => {
            const priceSpan = el.querySelector('.price');
            const priceVal = (Array.isArray(stockList) && stockList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(stockList[idx], state.currentDay) || -1) : -1) : -1;
            if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'stock');
        });

        // pif selection items
        const pifElems = Array.from(document.querySelectorAll('#pifSelection .selection-item'));
        pifElems.forEach((el, idx) => {
            const priceSpan = el.querySelector('.price');
            const priceVal = (Array.isArray(fundList) && fundList[idx]) ? (prices && typeof prices.getPrice === 'function' ? Number(prices.getPrice(fundList[idx], state.currentDay) || -1) : -1) : -1;
            if (priceSpan) priceSpan.textContent = fmtPrice(priceVal, 'pif');
        });

        // currency and gold info cards
        const currencyPriceSpan = document.querySelector('#currencyInfo .price');
        if (currencyPriceSpan) currencyPriceSpan.textContent = fmtPrice(assetData.currency.price, 'currency');
        const goldPriceSpan = document.querySelector('#goldInfo .price');
        if (goldPriceSpan) goldPriceSpan.textContent = fmtPrice(assetData.gold.price, 'gold');
    }

    function updateTotal() {
        if (!quantityInput || !totalAmount) return;
        const data = assetData[currentAsset] || assetData.account;
        const value = Number(String(quantityInput.value).replace(/\s/g, ''));
        const total = value * data.price;
        totalAmount.textContent = `${total.toLocaleString('ru-RU')} ₽`;
    }

    function updateUI() {
        syncSelectedAssetNames();

        assetCards.forEach((card) => {
            const asset = card.dataset.asset;
            if (asset === currentAsset) {
                card.classList.add('active');
                card.classList.remove('inactive');
                const name = card.querySelector('.name');
                const desc = card.querySelector('.desc');
                const arrow = card.querySelector('.arrow');
                if (name) name.classList.remove('faded');
                if (desc) desc.classList.remove('faded');
                if (arrow) arrow.classList.remove('faded');
            } else {
                card.classList.remove('active');
                card.classList.add('inactive');
                const name = card.querySelector('.name');
                const desc = card.querySelector('.desc');
                const arrow = card.querySelector('.arrow');
                if (name) name.classList.add('faded');
                if (desc) desc.classList.add('faded');
                if (arrow) arrow.classList.add('faded');
            }
        });

        document.querySelectorAll('.selection-card, .asset-info-card').forEach((el) => {
            el.classList.remove('visible');
        });

        const data = assetData[currentAsset] || assetData.account;
        const infoEl = document.getElementById(data.infoId);
        if (infoEl) infoEl.classList.add('visible');

        if (selectedAssetName) selectedAssetName.textContent = data.label;
        if (quantityLabel) quantityLabel.textContent = data.quantityLabel;
        if (unitLabel) unitLabel.textContent = data.unit;
        if (buyBtn) buyBtn.textContent = currentAction === 'buy' ? 'Купить' : 'Продать';
        if (sellBtn) sellBtn.textContent = currentAction === 'buy' ? 'Продать' : 'Купить';

        updateTotal();
        syncTradePanel();
    }

    function selectAsset(asset) {
        if (asset === currentAsset) return;
        currentAsset = asset;
        updateUI();
    }

    function syncTradePanel() {
        const state = readGameState();
        const available = document.querySelector('.deal-available');
        if (available) {
            const cash = safeNumber(state?.portfolio?.cash);
            const bank = safeNumber(state?.portfolio?.bankAccount?.balance);
            available.textContent = `Доступно: ${formatMoney(cash + bank)}`;
        }

        const price = assetData[currentAsset]?.price || 0;
        const amount = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
        if (totalAmount) totalAmount.textContent = `${(amount * price).toLocaleString('ru-RU')} ₽`;
    }

    function tryTrade(action) {
        const quantity = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
        if (!quantity || quantity <= 0) {
            alert('Введите корректное количество');
            return;
        }

        const engine = window.game && window.game.engine ? window.game.engine : null;
        const ticker = resolveTickerByAsset();

        if (!engine) {
            alert('Игра ещё не инициализирована');
            return;
        }

        if (!ticker) {
            alert('Тикер не выбран для текущего актива');
            return;
        }

        try {
            const state = readGameState();
            const nextState = JSON.parse(JSON.stringify(state));
            const result = action === 'buy' ? engine.buyAsset(nextState, ticker, quantity) : engine.sellAsset(nextState, ticker, quantity);
            if (window.game && typeof window.game.data === 'function') {
                window.game.data = () => result;
            }
            updateUI();
        } catch (error) {
            alert(error.message || 'Не удалось выполнить сделку');
        }
    }

    if (assetCards.length) {
        assetCards.forEach((card) => {
            card.addEventListener('click', () => {
                selectAsset(card.dataset.asset);
            });
        });
    }

    document.querySelectorAll('#bondsSelection .selection-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('#bondsSelection .selection-item').forEach((el) => {
                el.classList.remove('active');
                el.classList.add('inactive');
            });
            item.classList.add('active');
            item.classList.remove('inactive');
            currentBond = [...document.querySelectorAll('#bondsSelection .selection-item')].indexOf(item);
            updateUI();
        });
    });

    document.querySelectorAll('#stocksSelection .selection-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('#stocksSelection .selection-item').forEach((el) => {
                el.classList.remove('active');
                el.classList.add('inactive');
            });
            item.classList.add('active');
            item.classList.remove('inactive');
            currentStock = [...document.querySelectorAll('#stocksSelection .selection-item')].indexOf(item);
            updateUI();
        });
    });

    document.querySelectorAll('#pifSelection .selection-item').forEach((item) => {
        item.addEventListener('click', () => {
            document.querySelectorAll('#pifSelection .selection-item').forEach((el) => {
                el.classList.remove('active');
                el.classList.add('inactive');
            });
            item.classList.add('active');
            item.classList.remove('inactive');
            currentPif = [...document.querySelectorAll('#pifSelection .selection-item')].indexOf(item);
            updateUI();
        });
    });

    if (toggleSwitch) {
        toggleSwitch.addEventListener('click', (event) => {
            const option = event.target.closest('.option');
            if (!option || option.classList.contains('active')) return;

            if (buyOption) {
                buyOption.classList.toggle('active');
                buyOption.classList.toggle('inactive');
            }
            if (sellOption) {
                sellOption.classList.toggle('active');
                sellOption.classList.toggle('inactive');
            }

            currentAction = option.dataset.value;
            updateUI();
        });
    }

    if (quantityInput) {
        quantityInput.addEventListener('input', () => {
            updateTotal();
            syncTradePanel();
        });
    }

    if (buyBtn) {
        buyBtn.addEventListener('click', () => {
            tryTrade(currentAction === 'buy' ? 'buy' : 'sell');
        });
    }

    if (sellBtn) {
        sellBtn.addEventListener('click', () => {
            tryTrade(currentAction === 'buy' ? 'sell' : 'buy');
        });
    }

    if (quantityInput) {
        quantityInput.value = '1000';
    }
    // If game bootstrap is available, initialize first and then render UI so real state is shown.
    if (window.game && typeof window.game.initialize === 'function') {
        void window.game.initialize().then(() => updateUI()).catch(() => updateUI());
    } else {
        updateUI();
    }
})();
