(() => {
    const LOCAL_DEFAULT_STATE = {
        selectedTickers: {
            bonds: [],
            stocks: [],
            fundTickers: [],
            usdTicker: 'USD',
            goldTicker: 'GLDRUB_TOM',
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
                void window.game.initialize().then(() => {
                    try { renderPortfolio(); } catch (e) { /* ignore */ }
                }).catch(() => {});
            }

            return LOCAL_DEFAULT_STATE;
        } catch (error) {
            console.error('Не удалось прочитать состояние игры для портфеля: ', error);
            return LOCAL_DEFAULT_STATE;
        }
    }

    function formatMoney(value) {
        return `${Math.round(Number(value || 0)).toLocaleString('ru-RU')} ₽`;
    }

    function collectAssetValue(portfolio, tickerList) {
        const assetValues = portfolio.assetValues || {};
        let total = 0;
        tickerList.forEach((ticker) => {
            total += Number(assetValues[ticker]?.value || 0);
        });
        return total;
    }

    function renderPortfolio() {
        const gameData = readGameState();
        const portfolio = gameData.portfolio;
        const bankBalance = Number(portfolio.bankAccount?.balance || 0);
        const cash = Number(portfolio.cash || 0);
        const total = cash + bankBalance + Object.values(portfolio.assetValues || {}).reduce((sum, asset) => sum + Number(asset.value || 0), 0) + Object.values(portfolio.deposits || {}).reduce((sum, positions) => {
            if (!Array.isArray(positions)) return sum;
            return sum + positions.reduce((inner, item) => inner + Number(item?.amount || 0), 0);
        }, 0);

        const monthIndex = Math.max(1, Math.min(12, Math.ceil((Number(gameData.currentDay || 1) / 30) || 1)));
        const badge = document.querySelector('.month-badge');
        if (badge) badge.textContent = `МЕСЯЦ ${monthIndex} ИЗ 12`;

        const capitalValue = document.querySelector('.stat-card--capital .value');
        const freeValue = document.querySelector('.stat-card--free .value');
        if (capitalValue) capitalValue.textContent = formatMoney(total);
        if (freeValue) freeValue.textContent = formatMoney(cash);

        const rows = Array.from(document.querySelectorAll('.asset-row'));
        const values = [
            { label: 'Накопительный счёт', value: bankBalance, color: 'fill-green' },
            { label: 'ОФЗ', value: collectAssetValue(portfolio, ['OFZ']), color: 'fill-dark' },
            { label: 'Корп. облигации', value: collectAssetValue(portfolio, ['BONDS']), color: 'fill-mint' },
            { label: 'ВДО', value: collectAssetValue(portfolio, ['VDO']), color: 'fill-gold' },
            { label: 'ПИФ', value: collectAssetValue(portfolio, ['PIF1', 'PIF2']), color: 'fill-sand' },
            { label: 'Акции', value: collectAssetValue(portfolio, Object.keys(portfolio.assets || {}).filter((ticker) => !['BANK', 'OFZ', 'BONDS', 'VDO', 'PIF1', 'PIF2', 'USD', 'GOLD'].includes(ticker))), color: 'fill-blue' },
            { label: 'Иностранная валюта', value: collectAssetValue(portfolio, ['USD']), color: 'fill-purple' },
            { label: 'Золото', value: collectAssetValue(portfolio, ['GOLD']), color: 'fill-teal' }
        ];

        rows.forEach((row, index) => {
            const item = values[index];
            const title = row.querySelector('.asset-name');
            const value = row.querySelector('.asset-value');
            const fill = row.querySelector('.fill');
            if (title) {
                title.textContent = item.label;
                title.classList.toggle('inactive', (item.value || 0) <= 0);
            }
            if (value) {
                value.textContent = formatMoney(item.value);
                value.classList.toggle('inactive', (item.value || 0) <= 0);
            }
            if (fill) {
                const width = total > 0 ? Math.max(0, Math.min(100, (item.value / total) * 100)) : 0;
                fill.style.width = `${width}%`;
                fill.className = `fill ${item.color}`;
            }
        });
    }

    renderPortfolio();
})();
