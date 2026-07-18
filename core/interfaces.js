// core/interfaces.js

/**
 * Интерфейс для хранилища (Storage)
 * Может быть localStorage, БД, API
 */
export class IStorage {
    /**
     * Сохранить игру
     * @param {string} gameId - ID игры (например, 'game1')
     * @param {GameData} data - Данные игры
     */
    async saveGame(gameId, data) {
        throw new Error('Метод saveGame должен быть переопределён');
    }

    /**
     * Загрузить игру
     * @param {string} gameId - ID игры
     * @returns {Promise<GameData | null>}
     */
    async loadGame(gameId) {
        throw new Error('Метод loadGame должен быть переопределён');
    }
}

/**
 * Интерфейс для получения цен
 * Может быть из локального JSON или с сервера
 */
export class IPrices {
    /**
     * Получить цену актива в конкретный день
     * @param {string} ticker - Тикер
     * @param {number} day - Номер дня
     * @returns {number}
     */
    getPrice(ticker, day) {
        throw new Error('Метод getPrice должен быть переопределён');
    }
}