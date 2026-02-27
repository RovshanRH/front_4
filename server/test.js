// Минимальный тест подключения
try {
  const swaggerJsdoc = require('swagger-jsdoc');
  const swaggerUi = require('swagger-ui-express');
  
  console.log('✓ swagger-jsdoc загружен:', typeof swaggerJsdoc);
  console.log('✓ swagger-ui-express загружен:', typeof swaggerUi);
  
  // Проверим, что это функции
  if (typeof swaggerJsdoc === 'function') {
    console.log('✓ swaggerJsdoc - это функция');
  } else {
    console.log('✗ swaggerJsdoc - это НЕ функция');
  }
  
} catch (error) {
  console.error('Ошибка загрузки:', error.message);
}