const PLAYER_NAME_KEY = 'copilka-player-name';

export class LocalStorageAdapter {
    getPlayerGameKey() {
        const safeName = String(this.loadPlayerName()).trim();
        return safeName;
    }

    savePlayerName(name) {
        const safeName = String(name).trim();
        localStorage.setItem(PLAYER_NAME_KEY, safeName);
        return safeName;
    }

    loadPlayerName() {
        try {
            const value = localStorage.getItem(PLAYER_NAME_KEY);
            return value.trim();
        } catch (error) {
            throw new Error('Ошибка при загрузке имени игрока из localStorage: ' + error.message);
        }
    }

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