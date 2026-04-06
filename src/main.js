/**
 * main.js — Точка входа приложения
 * 
 * Здесь происходит:
 * 1. Инициализация ядра (Event Bus, Store)
 * 2. Инициализация модулей
 * 3. Запуск UI контроллера
 * 4. Обработка параметров URL для автоподключения
 * 
 * Архитектура: Dependency Injection
 * Каждый модуль получает зависимости через конструктор.
 * Это упрощает тестирование и замену компонентов.
 */

import { EventBus } from './core/event-bus.js';
import { Store } from './core/store.js';
import { Logger } from './modules/logger.js';
import { MediaManager } from './modules/media-manager.js';
import { WebRTCManager } from './modules/webrtc-manager.js';
import { UIController } from './modules/ui-controller.js';

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация ядра
    const eventBus = new EventBus();
    const store = new Store();
    
    // 2. Инициализация модулей (Dependency Injection)
    const logger = new Logger(eventBus);
    const mediaManager = new MediaManager(eventBus, store);
    const webrtcManager = new WebRTCManager(eventBus, store, mediaManager);
    const uiController = new UIController(eventBus, store, mediaManager, webrtcManager);
    
    // 3. Запуск UI
    uiController.init();
    
    // 4. Обработка параметров URL для автоподключения
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
        const roomInput = document.getElementById('room-id');
        if (roomInput) {
            roomInput.value = roomFromUrl;
        }
        setTimeout(() => uiController.joinRoom(), 500);
    }
    
    eventBus.emit('log:success', 'Приложение готово к работе');
    
    // Сохраняем ссылки на модули в глобальном объекте для отладки (только в dev)
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.__app = {
            eventBus,
            store,
            mediaManager,
            webrtcManager,
            uiController
        };
        console.log('Режим разработки: объект __app доступен в консоли');
    }
});