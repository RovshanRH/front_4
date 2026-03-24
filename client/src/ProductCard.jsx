import React from 'react'

export default function ProductCard({ product, onClick, onEdit, onDelete, canEdit, canDelete }) {
  const title = product.title || product.name
  const hasRating = product.rating !== undefined && product.rating !== null

  return (
    <div className="card" onClick={onClick} role="button" tabIndex={0} onKeyUp={(e) => e.key === 'Enter' && onClick()}>
      <div className="card-body">
        <div className="card-head-row">
          <p className="category">{product.category}</p>
          <p className="price">{product.price} руб.</p>
        </div>
        <h3>{title}</h3>
        <div className="card-meta-row">
          {product.stock !== undefined && <p className="stock">Остаток: {product.stock}</p>}
          {hasRating && <p className="rating">★ {product.rating}</p>}
        </div>
        {(canEdit || canDelete) && (
          <div className="card-actions">
            {canEdit && (
              <button className="btn" onClick={(e) => { e.stopPropagation(); onEdit(product) }}>
                Edit
              </button>
            )}
            {canDelete && (
              <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); onDelete(product.id) }}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
