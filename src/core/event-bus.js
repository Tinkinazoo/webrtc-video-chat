/**
 * Event Bus (Шина событий)
 * 
 * Паттерн: Mediator
 * 
 * Обеспечивает слабую связанность между модулями.
 * Модули не знают друг о друге, а общаются через события.
 * Это позволяет легко добавлять новые модули без изменения существующих.
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
    }
    
    /**
     * Подписка на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     * @returns {Function} Функция для отписки
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        // Возвращаем функцию для отписки
        return () => this.off(event, callback);
    }
    
    /**
     * Отписка от события
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) callbacks.splice(index, 1);
    }
    
    /**
     * Одноразовая подписка на событие
     * @param {string} event - Название события
     * @param {Function} callback - Функция-обработчик
     */
    once(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
    
    /**
     * Генерация события
     * @param {string} event - Название события
     * @param {any} data - Данные события
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        this.listeners.get(event).forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Ошибка в обработчике события "${event}":`, error);
            }
        });
    }
    
    /**
     * Удаление всех подписчиков
     * @param {string} event - Название события (опционально)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}