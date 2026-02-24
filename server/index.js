const express = require('express');
const cors = require('cors');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const products = require('./products');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Swagger configuration
const swaggerOptions = {
  swaggerDefinition: {  // Используем 'definition' для совместимости
    openapi: '2.0.0',  // Явно указываем версию OpenAPI
    info: {
      title: 'Products API',
      version: '1.0.0',
      description: 'API для управления каталогом товаров',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        Product: {
          type: 'object',
          required: ['id', 'name', 'category', 'description', 'price', 'stock', 'rating', 'image'],
          properties: {
            id: {
              type: 'integer',
              description: 'Уникальный идентификатор товара',
              example: 1
            },
            name: {
              type: 'string',
              description: 'Название товара',
              example: 'GIGABYTE GeForce RTX 4070 Ti GAMING OC 12GB'
            },
            category: {
              type: 'string',
              description: 'Категория товара',
              example: 'Видеокарты',
              enum: ['Видеокарты', 'Телевизоры', 'Смартфоны']
            },
            description: {
              type: 'string',
              description: 'Описание товара',
              example: 'Мощная игровая видеокарта NVIDIA RTX 4070 Ti с 12 ГБ видеопамяти GDDR6X.'
            },
            price: {
              type: 'number',
              description: 'Цена товара в рублях',
              example: 77990
            },
            stock: {
              type: 'integer',
              description: 'Количество товара на складе',
              example: 4
            },
            rating: {
              type: 'number',
              description: 'Рейтинг товара',
              example: 4.8,
              minimum: 0,
              maximum: 5
            },
            image: {
              type: 'string',
              description: 'URL изображения товара',
              example: 'https://c.dns-shop.ru/thumb/st4/fit/500/500/0ed9080ac788c2c189bfa796769243ad/e290232779fd9cb377f51b95409c7a5cf6d89ceb4c40a2ddb728dfc3549c8088.jpg.webp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Сообщение об ошибке',
              example: 'Product not found'
            }
          }
        }
      }
    },
    paths: {} // paths будут добавлены из аннотаций
  },
  apis: ['./index.js'], // путь к файлам с аннотациями
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Redirect root to API products
app.get('/', (req, res) => {
  res.redirect('/api/products');
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров
 *     description: Возвращает массив всех товаров в каталоге
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Успешный запрос
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
app.get('/api/products', (req, res) => {
  res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID
 *     description: Возвращает информацию о конкретном товаре по его идентификатору
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: Уникальный идентификатор товара
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Успешный запрос
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Товар не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.get('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = products.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  res.json(p);
});


/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Добавить новый товар
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Товар создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Неверный запрос
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/products', (req, res) => {
  const { name, category, description, price, stock, rating, image } = req.body;
  if (!name || !category || !description || price == null || stock == null || rating == null || !image) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const maxId = products.reduce((m, p) => Math.max(m, p.id || 0), 0);
  const newProduct = {
    id: maxId + 1,
    name,
    category,
    description,
    price,
    stock,
    rating,
    image,
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});


/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Обновить товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Поля для обновления (частичное обновление)
 *     responses:
 *       200:
 *         description: Товар обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Товар не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.patch('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const p = products.find(x => x.id === id);
  if (!p) return res.status(404).json({ error: 'Product not found' });
  const allowed = ['name', 'category', 'description', 'price', 'stock', 'rating', 'image'];
  Object.keys(req.body).forEach(key => {
    if (allowed.includes(key)) p[key] = req.body[key];
  });
  res.json(p);
});


/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: Товар удалён
 *       404:
 *         description: Товар не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = products.findIndex(x => x.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found' });
  products.splice(idx, 1);
  res.status(204).send();
});



app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Swagger documentation available at http://localhost:${PORT}/api-docs`);
});