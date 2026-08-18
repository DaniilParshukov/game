export class LocalPrices {
    constructor(yearRange = null, dataUrl = './prices/data.json') {
        this.yearRange = yearRange;
        this.prices = {};
        this.dateValuePairs = {};
        this.dataUrl = dataUrl;
        this.isLoaded = false;
        this.allData = null;
        this.availableRanges = [];
    }

    // Приватный метод инициализации (вызывается только из фабричного метода)
    async #init(yearRange) {
        try {
            const response = await fetch(this.dataUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            this.allData = await response.json();
            this.availableRanges = Object.keys(this.allData);
            
            if (this.availableRanges.length === 0) {
                throw new Error('Нет доступных данных');
            }

            let rangeToLoad = yearRange || this.availableRanges[0];
            if (!this.availableRanges.includes(rangeToLoad)) {
                rangeToLoad = this.availableRanges[0];
            }

            this.yearRange = rangeToLoad;
            this.processYearRange(this.allData[rangeToLoad]);
            this.isLoaded = true;
            
            return this;
        } catch (error) {
            console.error('Ошибка загрузки данных из JSON:', error);
            this.isLoaded = false;
            throw error;
        }
    }

    // Статический фабричный метод
    static async create(yearRange = null, dataUrl = './prices/data.json') {
        const instance = new LocalPrices(yearRange, dataUrl);
        await instance.#init(yearRange);
        return instance;
    }

    processYearRange(yearData) {
        this.prices = {};
        this.dateValuePairs = {};
        
        for (const [ticker, tickerData] of Object.entries(yearData)) {
            if (tickerData.price && Array.isArray(tickerData.price)) {
                this.prices[ticker] = tickerData.price;
            }
            
            if (tickerData.date_value_pairs && Array.isArray(tickerData.date_value_pairs)) {
                this.dateValuePairs[ticker] = tickerData.date_value_pairs;
            }
        }
    }

    getPrice(ticker, day) {
        if (!this.isLoaded) {
            throw new Error('Данные еще не загружены. Дождитесь загрузки.');
        }
        
        if (!this.prices[ticker]) {
            throw new Error(`Неизвестный тикер: ${ticker}, доступные тикеры: ${Object.keys(this.prices).join(', ')}`);
        }
        
        const dayIndex = Math.min(day - 1, this.prices[ticker].length - 1);
        return this.prices[ticker][dayIndex];
    }

    getHistory(ticker) {
        if (!this.isLoaded) {
            throw new Error('Данные еще не загружены. Дождитесь загрузки.');
        }
        return this.prices[ticker] || [];
    }

    getDateValuePairs(ticker) {
        if (!this.isLoaded) {
            throw new Error('Данные еще не загружены. Дождитесь загрузки.');
        }
        return this.dateValuePairs[ticker] || [];
    }

    getAvailableYearRanges() {
        return this.availableRanges;
    }

    async setYearRange(yearRange) {
        if (!this.availableRanges.includes(yearRange)) {
            throw new Error(`Диапазон ${yearRange} не найден`);
        }
        
        this.yearRange = yearRange;
        this.processYearRange(this.allData[yearRange]);
        this.isLoaded = true;
    }
}