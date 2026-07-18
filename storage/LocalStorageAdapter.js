// storage/LocalStorageAdapter.js

export class LocalStorageAdapter {
    /**
     * Сохранить игру в localStorage
     */
    async saveGame(gameId, data) {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(`game_${gameId}`, serialized);
            console.log(`✅ Игра ${gameId} сохранена`);
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
            throw error;
        }
    }

    /**
     * Загрузить игру из localStorage
     */
    async loadGame(gameId) {
        try {
            const raw = localStorage.getItem(`game_${gameId}`);
            if (!raw) {
                console.log(`ℹ️ Игра ${gameId} не найдена`);
                return null;
            }
            const data = JSON.parse(raw);
            console.log(`✅ Игра ${gameId} загружена`);
            return data;
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            throw error;
        }
    }

    /**
     * Удалить игру
     */
    async deleteGame(gameId) {
        localStorage.removeItem(`game_${gameId}`);
        console.log(`🗑️ Игра ${gameId} удалена`);
    }
}