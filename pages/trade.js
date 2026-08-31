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

    const assetData = {
        account: { label: 'Накопительный счет', quantityLabel: 'Сумма к пополнению/снятию', infoId: 'accountInfo' },
        bonds: { label: 'ОФЗ', quantityLabel: 'Количество', infoId: 'bondsSelection' },
        pif: { label: 'ПИФ1', quantityLabel: 'Количество', infoId: 'pifSelection' },
        stocks: { label: 'Акция1', quantityLabel: 'Количество', infoId: 'stocksSelection' },
        currency: { label: 'USD', quantityLabel: 'Количество', infoId: 'currencyInfo' },
        gold: { label: 'Золото', quantityLabel: 'Количество', infoId: 'goldInfo' }
    };

    function readGameState() {
        const liveState = window.game && typeof window.game.data === 'function' ? window.game.data() : null;
        if (liveState) return liveState;
        else {
            throw Error('Не удалось прочитать состояние игры');
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
        const selected = state?.selectedTickers || defaultState.selectedTickers;

        if (currentAsset === 'account') return selected.bankTicker;
        if (currentAsset === 'bonds') return selected.bonds?.[currentBond];
        if (currentAsset === 'stocks') return selected.stocks?.[currentStock];
        if (currentAsset === 'pif') {
            return selected.others?.find((ticker) => /PIF|FUND/i.test(String(ticker)));
        }
        if (currentAsset === 'currency') return 'USD';
        if (currentAsset === 'gold') return 'Gold';
        return 'BANK';
    }

    function syncSelectedAssetNames() {
        const state = readGameState();
        const selected = state?.selectedTickers || defaultState.selectedTickers;
        const prices = window.game && typeof window.game.getPrices === 'function' ? window.game.getPrices() : null;

        const bondList = Array.isArray(selected.bonds) ? selected.bonds : defaultState.selectedTickers.bonds;
        const stockList = Array.isArray(selected.stocks) ? selected.stocks : defaultState.selectedTickers.stocks;
        const otherList = Array.isArray(selected.others) ? selected.others : defaultState.selectedTickers.others;

        if (bondList.length) {
            currentBond = Math.min(currentBond, bondList.length - 1);
            const bondTicker = bondList[currentBond];
            assetData.bonds.label = bondTicker;
            assetData.bonds.price = prices && typeof prices.getPrice === 'function'
                ? Number(prices.getPrice(bondTicker, state.currentDay || 1) || 0)
                : 800;
        }

        if (stockList.length) {
            currentStock = Math.min(currentStock, stockList.length - 1);
            const stockTicker = stockList[currentStock];
            assetData.stocks.label = stockTicker;
            assetData.stocks.price = prices && typeof prices.getPrice === 'function'
                ? Number(prices.getPrice(stockTicker, state.currentDay || 1) || 0)
                : 3200;
        }

        const pifTicker = otherList.find((ticker) => /PIF|FUND/i.test(String(ticker))) || 'PIF1';
        assetData.pif.label = pifTicker;
        assetData.pif.price = prices && typeof prices.getPrice === 'function'
            ? Number(prices.getPrice(pifTicker, state.currentDay || 1) || 0)
            : 1250;

        assetData.currency.price = prices && typeof prices.getPrice === 'function'
            ? Number(prices.getPrice('USD', state.currentDay || 1) || 0)
            : 85.05;
        assetData.gold.price = prices && typeof prices.getPrice === 'function'
            ? Number(prices.getPrice('GLDRUB_TOM', state.currentDay || 1) || 0)
            : 10000;
    }

    function updateTotal() {
        if (!quantityInput || !totalAmount) return;
        const data = assetData[currentAsset] || assetData.account;
        const value = Number(String(quantityInput.value).replace(/\s/g, '')) || 0;
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
