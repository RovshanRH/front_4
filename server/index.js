const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const products = require('./products');
const { createClient } = require("redis");


const app = express();
const PORT = 3000;

const ACCESS_SECRET = process.env.ACCESS_SECRET || 'access_secret';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'refresh_secret';
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';
const USERS_CACHE_TTL = 60;       // 1 минута
const PRODUCTS_CACHE_TTL = 600;   // 10 минут

const ROLES = {
  USER: 'user',
  SELLER: 'seller',
  ADMIN: 'admin'
};

let users = [];
let nextUserId = 1;

let products = [];

// redis
const refreshTokens = new Set();

const redisClient = createClient({
  url: "redis://127.0.0.1:6379"
});

redisClient.on("error", (err) => {
  console.error("Redis error:", err);
});

async function initRedis() {
  await redisClient.connect();
  console.log("Redis connected");
}

app.use(cors());
app.use(express.json());

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Shop API',
    version: '1.0.0',
    description: 'API для практических работ 9-11: JWT, refresh и RBAC'
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Local server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      },
      refreshTokenHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-refresh-token'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Invalid credentials' }
        }
      },
      RegisterInput: {
        type: 'object',
        required: ['email', 'first_name', 'last_name', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          first_name: { type: 'string', example: 'Ivan' },
          last_name: { type: 'string', example: 'Ivanov' },
          password: { type: 'string', example: 'qwerty123' },
          role: { type: 'string', enum: ['user', 'seller', 'admin'], example: 'user' }
        }
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: { type: 'string', example: 'admin123' }
        }
      },
      AuthTokens: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          first_name: { type: 'string', example: 'Ivan' },
          last_name: { type: 'string', example: 'Ivanov' },
          role: { type: 'string', enum: ['user', 'seller', 'admin'], example: 'user' },
          is_blocked: { type: 'boolean', example: false }
        }
      },
      UserUpdateInput: {
        type: 'object',
        properties: {
          first_name: { type: 'string', example: 'Petr' },
          last_name: { type: 'string', example: 'Petrov' },
          role: { type: 'string', enum: ['user', 'seller', 'admin'], example: 'seller' }
        }
      },
      ProductInput: {
        type: 'object',
        required: ['title', 'category', 'description', 'price'],
        properties: {
          title: { type: 'string', example: 'RTX 4070' },
          category: { type: 'string', example: 'Видеокарты' },
          description: { type: 'string', example: 'Игровая видеокарта' },
          price: { type: 'number', example: 55000 },
          stock: { type: 'integer', example: 5 },
          rating: { type: 'number', example: 4.7 },
          image: { type: 'string', format: 'uri', example: 'https://example.com/image.jpg' }
        }
      },
      Product: {
        allOf: [
          { $ref: '#/components/schemas/ProductInput' },
          {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              name: { type: 'string', example: 'RTX 4070' }
            }
          }
        ]
      }
    }
  },
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Регистрация пользователя',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterInput' }
            }
          }
        },
        responses: {
          201: {
            description: 'Пользователь создан',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          400: { description: 'Некорректные данные' },
          409: { description: 'Пользователь уже существует' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Вход в систему',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginInput' }
            }
          }
        },
        responses: {
          200: {
            description: 'Пара токенов',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthTokens' }
              }
            }
          },
          400: { description: 'Некорректные данные' },
          401: { description: 'Неверные учетные данные' },
          403: { description: 'Пользователь заблокирован' }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        summary: 'Обновление access/refresh токенов',
        tags: ['Auth'],
        security: [{ refreshTokenHeader: [] }],
        responses: {
          200: {
            description: 'Новая пара токенов',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthTokens' }
              }
            }
          },
          400: { description: 'refresh token не передан' },
          401: { description: 'refresh token невалиден' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        summary: 'Текущий пользователь',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Профиль текущего пользователя',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          401: { description: 'Не авторизован' },
          404: { description: 'Пользователь не найден' }
        }
      }
    },
    '/api/users': {
      get: {
        summary: 'Получить список пользователей',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Список пользователей',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' }
                }
              }
            }
          },
          401: { description: 'Не авторизован' },
          403: { description: 'Недостаточно прав' }
        }
      }
    },
    '/api/users/{id}': {
      get: {
        summary: 'Получить пользователя по id',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            description: 'Пользователь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          404: { description: 'Пользователь не найден' }
        }
      },
      put: {
        summary: 'Обновить пользователя',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserUpdateInput' }
            }
          }
        },
        responses: {
          200: {
            description: 'Пользователь обновлен',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          400: { description: 'Некорректная роль' },
          404: { description: 'Пользователь не найден' }
        }
      },
      delete: {
        summary: 'Заблокировать пользователя',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          204: { description: 'Пользователь заблокирован' },
          404: { description: 'Пользователь не найден' }
        }
      }
    },
    '/api/products': {
      post: {
        summary: 'Создать товар',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductInput' }
            }
          }
        },
        responses: {
          201: {
            description: 'Товар создан',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          400: { description: 'Ошибка валидации' },
          403: { description: 'Недостаточно прав' }
        }
      },
      get: {
        summary: 'Получить список товаров',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'category', in: 'query', required: false, schema: { type: 'string' } }
        ],
        responses: {
          200: {
            description: 'Список товаров',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Product' }
                }
              }
            }
          }
        }
      }
    },
    '/api/products/{id}': {
      get: {
        summary: 'Получить товар по id',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          200: {
            description: 'Товар',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          404: { description: 'Товар не найден' }
        }
      },
      put: {
        summary: 'Обновить товар',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ProductInput' }
            }
          }
        },
        responses: {
          200: {
            description: 'Товар обновлен',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Product' }
              }
            }
          },
          400: { description: 'Ошибка валидации' },
          403: { description: 'Недостаточно прав' },
          404: { description: 'Товар не найден' }
        }
      },
      delete: {
        summary: 'Удалить товар',
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          204: { description: 'Товар удален' },
          403: { description: 'Недостаточно прав' },
          404: { description: 'Товар не найден' }
        }
      }
    }
  }
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/swagger.json', (req, res) => res.json(openApiSpec));

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
    is_blocked: user.is_blocked
  };
}

function toPublicProduct(product) {
  return {
    ...product,
    name: product.title
  };
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role
    },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role
    },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  try {
    const payload = jwt.verify(token, ACCESS_SECRET);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function roleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// Middleware чтения из кэша
function cacheMiddleware(keyBuilder, ttl) {
  return async (req, res, next) => {
    try {
      const key = keyBuilder(req);
      const cachedData = await redisClient.get(key);

      if (cachedData) {
        return res.json({
          source: "cache",
          data: JSON.parse(cachedData)
        });
      }

      req.cacheKey = key;
      req.cacheTTL = ttl;
      next();
    } catch (err) {
      console.error("Cache read error:", err);
      next();
    }
  };
}

// Сохранение ответа в кэш
async function saveToCache(key, data, ttl) {
  try {
    await redisClient.set(key, JSON.stringify(data), {
      EX: ttl
    });
  } catch (err) {
    console.error("Cache save error:", err);
  }
}

// Удаление кэша пользователей
async function invalidateUsersCache(userId = null) {
  try {
    await redisClient.del("users:all");
    if (userId) {
      await redisClient.del(`users:${userId}`);
    }
  } catch (err) {
    console.error("Users cache invalidate error:", err);
  }
}

function getRefreshTokenFromHeaders(req) {
  const headerToken = req.headers['x-refresh-token'];
  if (headerToken) {
    return String(headerToken).trim();
  }

  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme === 'Bearer' && token) {
    return token;
  }

  return '';
}

function validateProductPayload(payload) {
  const title = String(payload.title ?? payload.name ?? '').trim();
  const category = String(payload.category ?? '').trim();
  const description = String(payload.description ?? '').trim();
  const price = Number(payload.price);

  if (!title || !category || !description || Number.isNaN(price)) {
    return { error: 'title, category, description and price are required' };
  }

  if (price < 0) {
    return { error: 'price must be non-negative number' };
  }

  const data = { title, category, description, price };

  if (payload.stock !== undefined) {
    const stock = Number(payload.stock);
    if (!Number.isInteger(stock) || stock < 0) {
      return { error: 'stock must be non-negative integer' };
    }
    data.stock = stock;
  }

  if (payload.rating !== undefined) {
    const rating = Number(payload.rating);
    if (Number.isNaN(rating) || rating < 0 || rating > 5) {
      return { error: 'rating must be in range 0..5' };
    }
    data.rating = rating;
  }

  if (payload.image !== undefined) {
    data.image = String(payload.image).trim();
  }

  return { data };
}

function seedUsers() {
  const admin = {
    id: nextUserId++,
    email: 'admin@example.com',
    first_name: 'Admin',
    last_name: 'Root',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: ROLES.ADMIN,
    is_blocked: false
  };

  const seller = {
    id: nextUserId++,
    email: 'seller@example.com',
    first_name: 'Seller',
    last_name: 'Team',
    passwordHash: bcrypt.hashSync('seller123', 10),
    role: ROLES.SELLER,
    is_blocked: false
  };

  users.push(admin, seller);
}

seedUsers();

app.get('/', (req, res) => {
  res.json({
    message: 'Practice API 9-11',
    docs: {
      swaggerUi: `http://localhost:${PORT}/api-docs`,
      openApiJson: `http://localhost:${PORT}/swagger.json`
    },
    credentials: {
      admin: { email: 'admin@example.com', password: 'admin123' },
      seller: { email: 'seller@example.com', password: 'seller123' }
    }
  });
});

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const firstName = String(req.body.first_name ?? '').trim();
  const lastName = String(req.body.last_name ?? '').trim();
  const password = String(req.body.password ?? '');
  const role = String(req.body.role ?? ROLES.USER).trim().toLowerCase();

  if (!email || !firstName || !lastName || !password) {
    return res.status(400).json({ error: 'email, first_name, last_name and password are required' });
  }

  if (![ROLES.USER, ROLES.SELLER, ROLES.ADMIN].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const exists = users.some(u => u.email === email);
  if (exists) {
    return res.status(409).json({ error: 'user with this email already exists' });
  }

  const user = {
    id: nextUserId++,
    email,
    first_name: firstName,
    last_name: lastName,
    passwordHash: await bcrypt.hash(password, 10),
    role,
    is_blocked: false
  };

  users.push(user);
  return res.status(201).json(toPublicUser(user));
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email ?? '').trim().toLowerCase();
  const password = String(req.body.password ?? '');

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.is_blocked) {
    return res.status(403).json({ error: 'User is blocked' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.add(refreshToken);

  return res.json({ accessToken, refreshToken });
});

app.post('/api/auth/refresh', (req, res) => {
  const refreshToken = getRefreshTokenFromHeaders(req);

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required in headers' });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET);
    const userId = Number(payload.sub);
    const user = users.find(u => u.id === userId);

    if (!user || user.is_blocked) {
      refreshTokens.delete(refreshToken);
      return res.status(401).json({ error: 'User not found or blocked' });
    }

    refreshTokens.delete(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    refreshTokens.add(newRefreshToken);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    refreshTokens.delete(refreshToken);
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

app.get('/api/auth/me', authMiddleware, roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]), (req, res) => {
  const userId = Number(req.user.sub);
  const user = users.find(u => u.id === userId);

  if (!user || user.is_blocked) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json(toPublicUser(user));
});

app.get(
  "/api/users",
  authMiddleware,
  roleMiddleware(["admin"]),
  cacheMiddleware(() => "users:all", USERS_CACHE_TTL),
  async (req, res) => {
    const data = users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      blocked: u.blocked
    }));

    await saveToCache(req.cacheKey, data, req.cacheTTL);

    res.json({
      source: "server",
      data
    });
  }
);

app.get(
  "/api/users/:id",
  authMiddleware,
  roleMiddleware(["admin"]),
  cacheMiddleware((req) => `users:${req.params.id}`, USERS_CACHE_TTL),
  async (req, res) => {
    const user = users.find((u) => u.id === req.params.id);

    if (!user) {
      return res.status(404).json({
        error: "User not found"
      });
    }

    const data = {
      id: user.id,
      username: user.username,
      role: user.role,
      blocked: user.blocked
    };

    await saveToCache(req.cacheKey, data, req.cacheTTL);

    res.json({
      source: "server",
      data
    });
  }
);

// Обновить пользователя
app.put("/api/users/:id", authMiddleware, roleMiddleware(["admin"]), async (req, res) => {
  const { username, role, blocked } = req.body;
  const user = users.find((u) => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  if (username !== undefined) user.username = username;
  if (role !== undefined) user.role = role;
  if (blocked !== undefined) user.blocked = blocked;

  await invalidateUsersCache(user.id);

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    blocked: user.blocked
  });
});

// Заблокировать пользователя
app.delete("/api/users/:id", authMiddleware, roleMiddleware(["admin"]), async (req, res) => {
  const user = users.find((u) => u.id === req.params.id);

  if (!user) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  user.blocked = true;

  await invalidateUsersCache(user.id);

  res.json({
    message: "User blocked",
    id: user.id
  });
});

initRedis().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });
});

app.post('/api/products', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), (req, res) => {
  const validation = validateProductPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const newId = products.length === 0 ? 1 : Math.max(...products.map(p => p.id)) + 1;
  const product = { id: newId, ...validation.data };
  products.push(product);

  return res.status(201).json(toPublicProduct(product));
});

app.get('/api/products', authMiddleware, roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]), (req, res) => {
  const category = String(req.query.category ?? '').trim();

  if (!category) {
    return res.json(products.map(toPublicProduct));
  }

  const filtered = products.filter(p => p.category === category);
  return res.json(filtered.map(toPublicProduct));
});

app.get('/api/products/:id', authMiddleware, roleMiddleware([ROLES.USER, ROLES.SELLER, ROLES.ADMIN]), (req, res) => {
  const id = Number(req.params.id);
  const product = products.find(p => p.id === id);

  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  return res.json(toPublicProduct(product));
});

app.put('/api/products/:id', authMiddleware, roleMiddleware([ROLES.SELLER, ROLES.ADMIN]), (req, res) => {
  const id = Number(req.params.id);
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const validation = validateProductPayload(req.body);
  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const updated = { id, ...validation.data };
  products[index] = updated;

  return res.json(toPublicProduct(updated));
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware([ROLES.ADMIN]), (req, res) => {
  const id = Number(req.params.id);
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  products.splice(index, 1);
  return res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
