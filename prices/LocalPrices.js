// prices/LocalPrices.js

export class LocalPrices {
    constructor() {
        // Генерируем фейковые цены для демонстрации
        this.prices = this.generatePrices();
    }

    generatePrices() {
        const tickers = ['SBER', 'GAZP', 'YNDX', 'OZFZ', 'GOLD'];
        const prices = {};
        
        for (const ticker of tickers) {
            prices[ticker] = [];
            let price = 100 + Math.random() * 200;
            
            // Генерируем 365 дней с небольшим случайным движением
            for (let day = 0; day < 365; day++) {
                // Случайное блуждание
                const change = (Math.random() - 0.5) * 4;
                price = Math.max(10, price + change);
                prices[ticker].push(Math.round(price * 100) / 100);
            }
        }
        
        return prices;
    }

    getPrice(ticker, day) {
        if (!this.prices[ticker]) {
            throw new Error(`Неизвестный тикер: ${ticker}`);
        }
        
        const dayIndex = Math.min(day - 1, this.prices[ticker].length - 1);
        return this.prices[ticker][dayIndex];
    }

    getCurrentPrice(ticker) {
        // В реальной игре брали бы последнюю цену из массива
        const lastIndex = this.prices[ticker].length - 1;
        return this.prices[ticker][lastIndex];
    }

    /**
     * Получить историю цен для графика
     */
    getHistory(ticker) {
        return this.prices[ticker] || [];
    }
}