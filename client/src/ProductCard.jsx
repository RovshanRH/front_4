import React from 'react'

export default function ProductCard({ product, onClick, onEdit, onDelete }) {
  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0} onKeyUp={(e) => e.key === 'Enter' && onClick()}>
      <div className="card-image">
        {product.image ? <img src={product.image} alt={product.name} loading="lazy" /> : <div style={{padding:20,color:'#999'}}>No image</div>}
      </div>
      <div className="card-body">
        <h3>{product.name}</h3>
        <p className="category">{product.category}</p>
        <p className="price">{product.price} руб.</p>
        <p className="stock">Остаток: {product.stock}</p>
        <p className="rating">★ {product.rating}</p>
        <div className="card-actions">
          <button className="btn" onClick={(e) => { e.stopPropagation(); onEdit(product); }}>Edit</button>
          <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(product.id); }}>Delete</button>
        </div>
      </div>
    </div>
  )
}
