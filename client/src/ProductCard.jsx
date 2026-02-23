import React from 'react'

export default function ProductCard({ product, onClick }) {
  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0} oneKeyUp={(e) => e.key === 'Enter' && onClick()}>
      <div className="card-body">
        <h3>{product.name}</h3>
        <p className="category">{product.category}</p>
        <p className="price">{product.price} руб.</p>
        <p className="stock">Остаток: {product.stock}</p>
        <p className="rating">★ {product.rating}</p>
      </div>
    </div>
  )
}
