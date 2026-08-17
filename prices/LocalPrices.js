export class LocalPrices {
    constructor(yearRange = null, basePath = './data/') {
        this.yearRange = yearRange;
        this.prices = {};
        this.dateValuePairs = {};
        this.basePath = basePath;
        this.isLoaded = false;
        this.availableRanges = [];
    }

    // Загрузка данных из JSON файла
    async loadPricesFromJSON() {
        try {
            // Сначала загружаем список доступных годов
            await this.loadAvailableRanges();
            
            if (this.availableRanges.length === 0) {
                throw new Error('Нет доступных данных');
            }

            // Определяем какой диапазон загружать
            let rangeToLoad = this.yearRange;
            if (!rangeToLoad || !this.availableRanges.includes(rangeToLoad)) {
                rangeToLoad = this.availableRanges[0];
            }

            // Загружаем данные для выбранного диапазона
            const response = await fetch(`${this.basePath}${rangeToLoad}.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.processYearRange(data);
            this.isLoaded = true;
            this.yearRange = rangeToLoad;
            
            return true;
        } catch (error) {
            console.error('Ошибка загрузки данных из JSON:', error);
            return false;
        }
    }

    // Загрузка списка доступных диапазонов
    async loadAvailableRanges() {
        try {
            const response = await fetch(`${this.basePath}manifest.json`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.availableRanges = data.ranges || [];
            return this.availableRanges;
        } catch (error) {
            console.error('Ошибка загрузки списка диапазонов:', error);
            // Если нет manifest.json, пытаемся загрузить data.json
            try {
                const response = await fetch(`${this.basePath}data.json`);
                if (!response.ok) throw new Error('No data.json found');
                const data = await response.json();
                this.availableRanges = Object.keys(data);
                // Если загрузили data.json, можем его обработать
                if (this.availableRanges.length > 0) {
                    this.processYearRange(data[this.availableRanges[0]]);
                    this.isLoaded = true;
                    this.yearRange = this.availableRanges[0];
                }
                return this.availableRanges;
            } catch (e) {
                console.error('Не удалось загрузить данные:', e);
                return [];
            }
        }
    }

    processYearRange(yearData) {
        // Очищаем предыдущие данные
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
            throw new Error(`Неизвестный тикер: ${ticker}`);
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

    // Метод для смены года
    async setYearRange(yearRange) {
        if (!this.availableRanges.includes(yearRange)) {
            throw new Error(`Диапазон ${yearRange} не найден`);
        }
        
        this.yearRange = yearRange;
        this.prices = {};
        this.dateValuePairs = {};
        this.isLoaded = false;
        
        await this.loadPricesFromJSON();
    }
}