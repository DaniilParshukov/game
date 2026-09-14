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
 * @property {number} year - Выбранный год (2007-2024)
 * @property {Date} date - Текущяя дата (1-365:0-23:2007-2024)
 * @property {Array} history - История транзакций
 * @property {Object} MonthlyEvents - События по месяцам
 * @property {Object|null} pendingEvent - Текущее ожидающее событие
 */