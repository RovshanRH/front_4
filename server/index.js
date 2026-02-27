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
  definition: {
    openapi: '3.0.3',
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
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'GIGABYTE GeForce RTX 4070 Ti GAMING OC 12GB' },
            category: {
              type: 'string',
              enum: ['Видеокарты', 'Телевизоры', 'Смартфоны'],
              example: 'Видеокарты'
            },
            description: {
              type: 'string',
              example: 'Мощная игровая видеокарта NVIDIA RTX 4070 Ti с 12 ГБ видеопамяти GDDR6X.'
            },
            price: { type: 'number', example: 77990 },
            stock: { type: 'integer', example: 4 },
            rating: { type: 'number', minimum: 0, maximum: 5, example: 4.8 },
            image: {
              type: 'string',
              format: 'uri',
              example: 'https://c.dns-shop.ru/thumb/st4/fit/500/500/0ed9080ac788c2c189bfa796769243ad/e290232779fd9cb377f51b95409c7a5cf6d89ceb4c40a2ddb728dfc3549c8088.jpg.webp'
            }
          }
        },
        ProductInput: {
          type: 'object',
          required: ['name', 'category', 'description', 'price', 'stock', 'rating', 'image'],
          properties: {
            name: { type: 'string', example: 'MSI GeForce RTX 4080 VENTUS 3X 16GB' },
            category: {
              type: 'string',
              enum: ['Видеокарты', 'Телевизоры', 'Смартфоны'],
              example: 'Видеокарты'
            },
            description: {
              type: 'string',
              example: 'Современная видеокарта RTX 4080 с отличным охлаждением'
            },
            price: { type: 'number', example: 124990 },
            stock: { type: 'integer', example: 7 },
            rating: { type: 'number', minimum: 0, maximum: 5, example: 4.7 },
            image: {
              type: 'string',
              format: 'uri',
              example: 'https://example.com/images/msi-rtx4080.jpg'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Product not found' }
          }
        }
      }
    }
  },
  apis: ['./index.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true
}));

// Redirect root → /api/products
app.get('/', (req, res) => {
  res.redirect('/api/products');
});

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Получить список всех товаров
 *     description: Возвращает массив всех товаров. Можно фильтровать по категории.
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: category
 *         required: false
 *         schema:
 *           type: string
 *           enum: [Видеокарты, Телевизоры, Смартфоны]
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
  const { category } = req.query;
  if (category) {
    const filtered = products.filter(p => p.category === category);
    return res.json(filtered);
  }
  res.json(products);
});

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Получить товар по ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *     responses:
 *       200:
 *         description: Товар найден
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
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Добавить новый товар
 *     description: Создаёт новый товар в каталоге
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *           example:   # ← Вот этот блок делает пример видимым и копируемым в Swagger UI
 *             name: "Samsung Galaxy S25 Ultra"
 *             category: "Смартфоны"
 *             description: "Флагман 2026 года с 200 МП камерой и Snapdragon 8 Elite"
 *             price: 149990
 *             stock: 12
 *             rating: 4.9
 *             image: "https://example.com/images/s25-ultra.jpg"
 *     responses:
 *       201:
 *         description: Товар успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Ошибка валидации (неверные данные)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Внутренняя ошибка сервера
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
app.post('/api/products', (req, res) => {
  try {
    const { name, category, description, price, stock, rating, image } = req.body;

    const requiredFields = ['name', 'category', 'description', 'price', 'stock', 'rating', 'image'];
    const missing = requiredFields.filter(f => req.body[f] == null);
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const allowedCategories = ['Видеокарты', 'Телевизоры', 'Смартфоны'];
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({ error: `Invalid category. Allowed: ${allowedCategories.join(', ')}` });
    }

    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      return res.status(400).json({ error: 'Rating must be between 0 and 5' });
    }

    const priceNum = Number(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      return res.status(400).json({ error: 'Price must be positive number' });
    }

    const stockNum = Number(stock);
    if (isNaN(stockNum) || stockNum < 0 || !Number.isInteger(stockNum)) {
      return res.status(400).json({ error: 'Stock must be non-negative integer' });
    }

    const newId = products.length === 0 ? 1 : Math.max(...products.map(p => p.id)) + 1;

    const newProduct = {
      id: newId,
      name: String(name).trim(),
      category,
      description: String(description).trim(),
      price: priceNum,
      stock: stockNum,
      rating: ratingNum,
      image: String(image).trim(),
    };

    products.push(newProduct);
    res.status(201).json(newProduct);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /api/products/{id}:
 *   patch:
 *     summary: Частично обновить товар
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: 'string' }
 *               category:
 *                 type: 'string'
 *                 enum: [Видеокарты, Телевизоры, Смартфоны]
 *               description: { type: 'string' }
 *               price: { type: 'number' }
 *               stock: { type: 'integer' }
 *               rating: { type: 'number', minimum: 0, maximum: 5 }
 *               image: { type: 'string', format: 'uri' }
 *     responses:
 *       200:
 *         description: Товар обновлён
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Неверные данные
 *       404:
 *         description: Товар не найден
 */
app.patch('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  if (req.body.category) {
    const allowed = ['Видеокарты', 'Телевизоры', 'Смартфоны'];
    if (!allowed.includes(req.body.category)) {
      return res.status(400).json({ error: `Invalid category. Allowed: ${allowed.join(', ')}` });
    }
  }

  if (req.body.rating !== undefined) {
    const r = Number(req.body.rating);
    if (isNaN(r) || r < 0 || r > 5) {
      return res.status(400).json({ error: 'Rating must be 0–5' });
    }
  }

  ['name', 'category', 'description', 'image'].forEach(key => {
    if (req.body[key] !== undefined) product[key] = String(req.body[key]).trim();
  });

  if (req.body.price !== undefined) {
    const p = Number(req.body.price);
    if (!isNaN(p) && p > 0) product.price = p;
  }

  if (req.body.stock !== undefined) {
    const s = Number(req.body.stock);
    if (!isNaN(s) && s >= 0 && Number.isInteger(s)) product.stock = s;
  }

  if (req.body.rating !== undefined) {
    product.rating = Number(req.body.rating);
  }

  res.json(product);
});

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Удалить товар
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       204:
 *         description: Товар удалён
 *       404:
 *         description: Товар не найден
 */
app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ error: 'Product not found' });
  products.splice(index, 1);
  res.status(204).send();
});

// Raw OpenAPI JSON (удобно для Postman / генерации клиентов)
app.get('/swagger.json', (req, res) => {
  res.json(swaggerSpec);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
  console.log(`Swagger UI    → http://localhost:${PORT}/api-docs`);
});