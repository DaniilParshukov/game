import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonPath = path.join(__dirname, 'data.json');

export class LocalPrices {
    constructor(yearRange = null) {
        this.yearRange = yearRange;
        this.prices = {};
        this.dateValuePairs = {};
        this.loadPricesFromJSON();
    }

    loadPricesFromJSON() {
        try {
            const jsonData = fs.readFileSync(jsonPath, 'utf8');
            const data = JSON.parse(jsonData);

            if (this.yearRange && data[this.yearRange]) {
                this.processYearRange(data[this.yearRange]);
            } else {
                const firstRange = Object.keys(data)[0];
                if (firstRange) {
                    this.processYearRange(data[firstRange]);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки данных из JSON:', error);
        }
    }

    processYearRange(yearData) {
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
        if (!this.prices[ticker]) {
            throw new Error(`Неизвестный тикер: ${ticker}`);
        }
        
        const dayIndex = Math.min(day - 1, this.prices[ticker].length - 1);
        return this.prices[ticker][dayIndex];
    }

    getHistory(ticker) {
        return this.prices[ticker] || [];
    }

    getDateValuePairs(ticker) {
        return this.dateValuePairs[ticker] || [];
    }

    getAvailableYearRanges() {
        try {
            const jsonPath = path.join(__dirname, 'prices_data.json');
            const jsonData = fs.readFileSync(jsonPath, 'utf8');
            const data = JSON.parse(jsonData);
            return Object.keys(data);
        } catch (error) {
            console.error('Ошибка получения доступных годов:', error);
            return [];
        }
    }

    // Метод для смены года
    setYearRange(yearRange) {
        this.yearRange = yearRange;
        this.prices = {};
        this.dateValuePairs = {};
        this.loadPricesFromJSON();
    }
}

// Пример использования:
/*
// Создаем экземпляр с конкретным годовым диапазоном
const prices = new LocalPrices('2007-08-01_2008-08-31');

// Получение цен
console.log(prices.getPrice('BANK_DEPOSIT_RATE_RUB', 5));
console.log(prices.getHistory('RU000A0DZ3A9'));

// Смена года
prices.setYearRange('2021-08-01_2022-08-31');
console.log(prices.getPrice('STOCKS_SBER', 1));

// Получение доступных годов
console.log(prices.getAvailableYearRanges());
*/