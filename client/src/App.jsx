import React, { useEffect, useMemo, useState } from 'react'
import ProductCard from './ProductCard'
import apiClient, { clearTokens, getAccessToken, saveTokens } from './apiClient'

const ROLE = {
  USER: 'user',
  SELLER: 'seller',
  ADMIN: 'admin'
}

const emptyProduct = {
  title: '',
  category: '',
  description: '',
  price: '',
  stock: '',
  rating: '',
  image: ''
}

const emptyRegisterForm = {
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role: ROLE.USER
}

const emptyLoginForm = {
  email: '',
  password: ''
}

export default function App() {
  const [authMode, setAuthMode] = useState('login')
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm)
  const [loginForm, setLoginForm] = useState(emptyLoginForm)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [products, setProducts] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [newProduct, setNewProduct] = useState(emptyProduct)
  const [editProduct, setEditProduct] = useState(null)

  const [users, setUsers] = useState([])

  const isSeller = user?.role === ROLE.SELLER || user?.role === ROLE.ADMIN
  const isAdmin = user?.role === ROLE.ADMIN

  const categories = useMemo(() => {
    const values = products.map((p) => p.category).filter(Boolean)
    return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  }, [products])

  useEffect(() => {
    bootstrapSession()
  }, [])

  async function bootstrapSession() {
    setLoading(true)
    setError('')
    const token = getAccessToken()

    if (!token) {
      setLoading(false)
      return
    }

    try {
      await loadMeAndData()
    } catch (e) {
      clearTokens()
      setUser(null)
      setProducts([])
      setUsers([])
      setError(extractError(e, 'Сессия истекла. Выполните вход снова.'))
    } finally {
      setLoading(false)
    }
  }

  async function loadMeAndData() {
    const me = await apiClient.get('/auth/me')
    setUser(me.data)

    const productsRes = await apiClient.get('/products')
    setProducts(productsRes.data)

    if (me.data.role === ROLE.ADMIN) {
      const usersRes = await apiClient.get('/users')
      setUsers(usersRes.data)
    } else {
      setUsers([])
    }
  }

  function extractError(err, fallback) {
    return err?.response?.data?.error || fallback
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')

    try {
      await apiClient.post('/auth/register', registerForm)
      setAuthMode('login')
      setRegisterForm(emptyRegisterForm)
      setError('Регистрация успешна. Теперь выполните вход.')
    } catch (e2) {
      setError(extractError(e2, 'Не удалось зарегистрироваться'))
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')

    try {
      const response = await apiClient.post('/auth/login', loginForm)
      const { accessToken, refreshToken } = response.data
      saveTokens(accessToken, refreshToken)
      setLoginForm(emptyLoginForm)
      await loadMeAndData()
    } catch (e2) {
      setError(extractError(e2, 'Не удалось выполнить вход'))
    }
  }

  function handleLogout() {
    clearTokens()
    setUser(null)
    setProducts([])
    setUsers([])
    setError('')
  }

  async function handleCreateProduct(e) {
    e.preventDefault()
    setError('')

    try {
      const payload = {
        title: newProduct.title,
        category: newProduct.category,
        description: newProduct.description,
        price: Number(newProduct.price),
        stock: newProduct.stock === '' ? undefined : Number(newProduct.stock),
        rating: newProduct.rating === '' ? undefined : Number(newProduct.rating),
        image: newProduct.image || undefined
      }

      const response = await apiClient.post('/products', payload)
      setProducts((prev) => [...prev, response.data])
      setNewProduct(emptyProduct)
    } catch (e2) {
      setError(extractError(e2, 'Не удалось создать товар'))
    }
  }

  async function handleLoadProductById(id) {
    setError('')

    try {
      const response = await apiClient.get(`/products/${id}`)
      setSelectedProduct(response.data)
    } catch (e2) {
      setError(extractError(e2, 'Не удалось загрузить товар'))
    }
  }

  async function handleUpdateProduct(e) {
    e.preventDefault()
    if (!editProduct) return

    setError('')

    try {
      const payload = {
        title: editProduct.title || editProduct.name,
        category: editProduct.category,
        description: editProduct.description,
        price: Number(editProduct.price),
        stock: editProduct.stock === '' || editProduct.stock === undefined ? undefined : Number(editProduct.stock),
        rating: editProduct.rating === '' || editProduct.rating === undefined ? undefined : Number(editProduct.rating),
        image: editProduct.image || undefined
      }

      const response = await apiClient.put(`/products/${editProduct.id}`, payload)
      const updated = response.data
      setProducts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setEditProduct(null)
      if (selectedProduct?.id === updated.id) {
        setSelectedProduct(updated)
      }
    } catch (e2) {
      setError(extractError(e2, 'Не удалось обновить товар'))
    }
  }

  async function handleDeleteProduct(id) {
    if (!window.confirm('Удалить товар?')) return
    setError('')

    try {
      await apiClient.delete(`/products/${id}`)
      setProducts((prev) => prev.filter((item) => item.id !== id))
      if (selectedProduct?.id === id) {
        setSelectedProduct(null)
      }
    } catch (e2) {
      setError(extractError(e2, 'Не удалось удалить товар'))
    }
  }

  async function loadUsers() {
    if (!isAdmin) return

    try {
      const response = await apiClient.get('/users')
      setUsers(response.data)
    } catch (e2) {
      setError(extractError(e2, 'Не удалось получить список пользователей'))
    }
  }

  async function handleUserRoleChange(targetUser, role) {
    try {
      await apiClient.put(`/users/${targetUser.id}`, {
        first_name: targetUser.first_name,
        last_name: targetUser.last_name,
        role
      })
      await loadUsers()
    } catch (e2) {
      setError(extractError(e2, 'Не удалось обновить роль пользователя'))
    }
  }

  async function handleBlockUser(targetUser) {
    if (!window.confirm(`Заблокировать пользователя ${targetUser.email}?`)) return

    try {
      await apiClient.delete(`/users/${targetUser.id}`)
      await loadUsers()
    } catch (e2) {
      setError(extractError(e2, 'Не удалось заблокировать пользователя'))
    }
  }

  if (loading) {
    return <div className="screen-center">Загрузка...</div>
  }

  if (!user) {
    return (
      <div className="screen-center">
        <div className="auth-card">
          <h1>Shop Auth</h1>

          <div className="tabs">
            <button className={`btn ${authMode === 'login' ? 'btn-primary' : ''}`} onClick={() => setAuthMode('login')}>Вход</button>
            <button className={`btn ${authMode === 'register' ? 'btn-primary' : ''}`} onClick={() => setAuthMode('register')}>Регистрация</button>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLogin}>
              <input placeholder="Email" type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} required />
              <input placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} required />
              <button type="submit" className="btn btn-primary">Войти</button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <input placeholder="Email" type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} required />
              <input placeholder="Имя" value={registerForm.first_name} onChange={(e) => setRegisterForm({ ...registerForm, first_name: e.target.value })} required />
              <input placeholder="Фамилия" value={registerForm.last_name} onChange={(e) => setRegisterForm({ ...registerForm, last_name: e.target.value })} required />
              <input placeholder="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} required />
              <select value={registerForm.role} onChange={(e) => setRegisterForm({ ...registerForm, role: e.target.value })}>
                <option value={ROLE.USER}>Пользователь</option>
                <option value={ROLE.SELLER}>Продавец</option>
                <option value={ROLE.ADMIN}>Администратор</option>
              </select>
              <button type="submit" className="btn btn-primary">Зарегистрироваться</button>
            </form>
          )}

          {error && <p className="error-text">{error}</p>}
          <p className="hint">Демо: admin@example.com / admin123</p>
          <p className="hint">Демо: seller@example.com / seller123</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div>
            <h1>Shop Dashboard</h1>
            <p>{user.email} | role: {user.role}</p>
          </div>
          <button className="btn" onClick={handleLogout}>Выйти</button>
        </div>
      </header>

      <main>
        {error && <p className="error-text global-error">{error}</p>}

        {isSeller && (
          <section className="panel">
            <h2>Создание товара</h2>
            <form onSubmit={handleCreateProduct}>
              <input placeholder="Название" value={newProduct.title} onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })} required />
              <input placeholder="Категория" list="categories" value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} required />
              <datalist id="categories">
                {categories.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <input placeholder="Описание" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} required />
              <input type="number" placeholder="Цена" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
              <input type="number" placeholder="Остаток" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} />
              <input type="number" step="0.1" placeholder="Рейтинг 0..5" value={newProduct.rating} onChange={(e) => setNewProduct({ ...newProduct, rating: e.target.value })} />
              <input placeholder="URL изображения" value={newProduct.image} onChange={(e) => setNewProduct({ ...newProduct, image: e.target.value })} />
              <button type="submit" className="btn btn-primary">Создать товар</button>
            </form>
          </section>
        )}

        <section className="panel">
          <h2>Товары</h2>
          <div className="grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                canEdit={isSeller}
                canDelete={isAdmin}
                onClick={() => handleLoadProductById(product.id)}
                onEdit={(p) => setEditProduct({ ...p, title: p.title || p.name })}
                onDelete={handleDeleteProduct}
              />
            ))}
          </div>
        </section>

        {isAdmin && (
          <section className="panel">
            <h2>Пользователи</h2>
            <div className="users-list">
              {users.map((item) => (
                <div className="user-row" key={item.id}>
                  <div>
                    <strong>{item.email}</strong>
                    <div>{item.first_name} {item.last_name}</div>
                    <div>Статус: {item.is_blocked ? 'blocked' : 'active'}</div>
                  </div>
                  <div className="user-actions">
                    <select value={item.role} onChange={(e) => handleUserRoleChange(item, e.target.value)}>
                      <option value={ROLE.USER}>user</option>
                      <option value={ROLE.SELLER}>seller</option>
                      <option value={ROLE.ADMIN}>admin</option>
                    </select>
                    <button className="btn btn-danger" disabled={item.is_blocked} onClick={() => handleBlockUser(item)}>Блокировать</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {selectedProduct && (
        <div className="modal" onClick={() => setSelectedProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelectedProduct(null)}>x</button>
            {selectedProduct.image && <img src={selectedProduct.image} alt={selectedProduct.title || selectedProduct.name} />}
            <h2>{selectedProduct.title || selectedProduct.name}</h2>
            <p className="category">{selectedProduct.category}</p>
            <p>{selectedProduct.description}</p>
            <p className="price">Цена: {selectedProduct.price} руб.</p>
            {selectedProduct.stock !== undefined && <p>Остаток: {selectedProduct.stock}</p>}
            {selectedProduct.rating !== undefined && <p>Рейтинг: {selectedProduct.rating}</p>}
          </div>
        </div>
      )}

      {editProduct && (
        <div className="modal" onClick={() => setEditProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setEditProduct(null)}>x</button>
            <h2>Редактирование товара</h2>
            <form onSubmit={handleUpdateProduct}>
              <input value={editProduct.title || ''} onChange={(e) => setEditProduct({ ...editProduct, title: e.target.value })} required />
              <input value={editProduct.category || ''} onChange={(e) => setEditProduct({ ...editProduct, category: e.target.value })} required />
              <input value={editProduct.description || ''} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} required />
              <input type="number" value={editProduct.price || ''} onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })} required />
              <input type="number" value={editProduct.stock ?? ''} onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })} />
              <input type="number" step="0.1" value={editProduct.rating ?? ''} onChange={(e) => setEditProduct({ ...editProduct, rating: e.target.value })} />
              <input value={editProduct.image ?? ''} onChange={(e) => setEditProduct({ ...editProduct, image: e.target.value })} />
              <button className="btn btn-primary" type="submit">Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
