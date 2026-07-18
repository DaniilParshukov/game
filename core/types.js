// core/types.js

/**
 * @typedef {Object} Asset
 * @property {string} ticker - Тикер актива (например, 'SBER')
 * @property {number} quantity - Количество
 */

/**
 * @typedef {Object} Portfolio
 * @property {number} cash - Деньги на счету
 * @property {Object.<string, number>} assets - Объект { ticker: quantity }
 */

/**
 * @typedef {Object} GameData
 * @property {Portfolio} portfolio
 * @property {number} currentDay - Текущий день (1-365)
 * @property {Array} history - История транзакций
 */

// Экспортируем для других файлов
export const TYPES = {
    // Просто заглушка для документации
};