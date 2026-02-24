import React, { useEffect, useState, useMemo } from 'react'
import ProductCard from './ProductCard'

const API = 'http://localhost:4000/api/products'

export default function App() {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)
  const [editProduct, setEditProduct] = useState(null)
  const [addModal, setAddModal] = useState(false)

  const [newProduct, setNewProduct] = useState({
    name: '', category: '', description: '', price: '', stock: '', rating: '', image: ''
  })
  const [newCustomCategory, setNewCustomCategory] = useState('')
  const [editCustomCategory, setEditCustomCategory] = useState('')

  useEffect(() => {
    fetch(API)
      .then(r => r.json())
      .then(setProducts)
      .catch(console.error)
  }, [])

  const categories = useMemo(() => {
    const s = new Set(products.map(p => p.category).filter(Boolean))
    return Array.from(s).sort()
  }, [products])

  // Prevent body scroll when any modal is open
  useEffect(() => {
    if (selected || editProduct || addModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected, editProduct, addModal])

  function handleAdd(e) {
    e.preventDefault()
    const body = {
      name: newProduct.name,
      category: newProduct.category === '__custom' ? newCustomCategory : newProduct.category,
      description: newProduct.description,
      price: Number(newProduct.price),
      stock: Number(newProduct.stock),
      rating: Number(newProduct.rating),
      image: newProduct.image,
    }
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => r.json())
      .then(p => {
        setProducts(prev => [...prev, p])
        setNewProduct({ name: '', category: '', description: '', price: '', stock: '', rating: '', image: '' })
        setNewCustomCategory('')
        setAddModal(false)
      })
      .catch(console.error)
  }

  function handleDelete(id) {
    if (!confirm('Удалить товар?')) return
    fetch(`${API}/${id}`, { method: 'DELETE' })
      .then(r => {
        if (r.status === 204) {
          setProducts(prev => prev.filter(p => p.id !== id))
          if (selected && selected.id === id) setSelected(null)
        } else return r.json().then(err => Promise.reject(err))
      })
      .catch(console.error)
  }

  function handleEditSubmit(e) {
    e.preventDefault()
    const id = editProduct.id
    const body = {
      name: editProduct.name,
      category: editProduct.category === '__custom' ? editCustomCategory : editProduct.category,
      description: editProduct.description,
      price: Number(editProduct.price),
      stock: Number(editProduct.stock),
      rating: Number(editProduct.rating),
      image: editProduct.image,
    }
    fetch(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(r => {
        if (!r.ok) return r.json().then(err => Promise.reject(err))
        return r.json()
      })
      .then(updated => {
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p))
        setEditProduct(null)
        setEditCustomCategory('')
        if (selected && selected.id === updated.id) setSelected(updated)
      })
      .catch(console.error)
  }

  useEffect(() => {
    if (editProduct) setEditCustomCategory('')
  }, [editProduct])

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <h1>DNS Shop</h1>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setAddModal(true)}>Добавить товар</button>
          </div>
        </div>
      </header>
      <main>
        <div className="grid">
          {products.map(p => (
            <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} onEdit={(prod) => setEditProduct({...prod})} onDelete={handleDelete} />
          ))}
        </div>
      </main>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <img src={selected.image} alt={selected.name} loading="lazy" />
            <h2>{selected.name}</h2>
            <p className="category">{selected.category}</p>
            <p className="desc">{selected.description}</p>
            <p className="price">Цена: {selected.price} руб.</p>
            <p>На складе: {selected.stock}</p>
            <p>Рейтинг: {selected.rating}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { setEditProduct(selected); setSelected(null); }}>Edit</button>
              <button className="btn btn-danger" onClick={() => { handleDelete(selected.id); }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {addModal && (
        <div className="modal" onClick={() => setAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setAddModal(false)}>×</button>
            <h2>Добавить товар</h2>
            <form onSubmit={handleAdd}>
              <input placeholder="Название" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} required />
              <select value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} required>
                <option value="">Выберите категорию</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom">Добавить свою категорию...</option>
              </select>
              {newProduct.category === '__custom' && (
                <input placeholder="Новая категория" value={newCustomCategory} onChange={e => setNewCustomCategory(e.target.value)} required />
              )}
              <input placeholder="Цена" type="number" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} required />
              <input placeholder="Остаток" type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} required />
              <input placeholder="Рейтинг" type="number" step="0.1" value={newProduct.rating} onChange={e => setNewProduct({...newProduct, rating: e.target.value})} required />
              <input placeholder="URL изображения" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} required />
              <input placeholder="Краткое описание" value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} required />
              <button className="btn btn-primary" type="submit">Добавить</button>
            </form>
          </div>
        </div>
      )}

      {editProduct && (
        <div className="modal" onClick={() => setEditProduct(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setEditProduct(null)}>×</button>
            <h2>Редактировать товар</h2>
            <form onSubmit={handleEditSubmit}>
              <input value={editProduct.name} onChange={e => setEditProduct({...editProduct, name: e.target.value})} required />
              <select value={editProduct.category} onChange={e => setEditProduct({...editProduct, category: e.target.value})} required>
                <option value="">Выберите категорию</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom">Добавить свою категорию...</option>
              </select>
              {editProduct.category === '__custom' && (
                <input placeholder="Новая категория" value={editCustomCategory} onChange={e => setEditCustomCategory(e.target.value)} required />
              )}
              <input type="number" value={editProduct.price} onChange={e => setEditProduct({...editProduct, price: e.target.value})} required />
              <input type="number" value={editProduct.stock} onChange={e => setEditProduct({...editProduct, stock: e.target.value})} required />
              <input type="number" step="0.1" value={editProduct.rating} onChange={e => setEditProduct({...editProduct, rating: e.target.value})} required />
              <input value={editProduct.image} onChange={e => setEditProduct({...editProduct, image: e.target.value})} required />
              <input value={editProduct.description} onChange={e => setEditProduct({...editProduct, description: e.target.value})} required />
              <button className="btn btn-primary" type="submit">Сохранить</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
