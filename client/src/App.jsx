import React, { useEffect, useState } from 'react'
import ProductCard from './ProductCard'

export default function App() {
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('http://localhost:4000/api/products')
      .then(r => r.json())
      .then(setProducts)
      .catch(console.error)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selected])

  return (
    <div className="app">
      <header>
        <h1>DNS Shop</h1>
      </header>
      <main>
        <div className="grid">
          {products.map(p => (
            <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
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
          </div>
        </div>
      )}
    </div>
  )
}
