import React from 'react';
import { useStore } from '../context/StoreContext';
import { formatPKR } from '@etimad/ui';

export const ProductCard = ({ product }) => {
  const { addToCart, storeConfig } = useStore();
  const currencySymbol = storeConfig?.tenant?.currencySymbol || 'Rs.';
  const showStockBadge = storeConfig?.features?.showStockBadge !== false;

  const price = product.pricing?.websitePrice || product.pricing?.retailPrice || 0;
  const isOutOfStock = product.isOutOfStock || product.stock <= 0;
  const imageUrl = product.images?.[0]?.url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';

  return (
    <div className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {showStockBadge && (
          <div className="absolute top-2 right-2">
            {isOutOfStock ? (
              <span className="bg-rose-600/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                Out of Stock
              </span>
            ) : product.stock <= 5 ? (
              <span className="bg-amber-500/90 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                Only {product.stock} Left
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-grow justify-between space-y-3">
        <div>
          {product.category && (
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {product.category}
            </span>
          )}
          <h3 className="font-semibold text-slate-800 text-sm line-clamp-2 leading-snug mt-1 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="font-bold text-base text-slate-900">
            {formatPKR(price, currencySymbol)}
          </div>

          <button
            onClick={() => addToCart(product, 1)}
            disabled={isOutOfStock}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isOutOfStock
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'btn-primary shadow-sm hover:shadow active:scale-95'
            }`}
          >
            {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductGrid = () => {
  const { products, loading } = useStore();

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-slate-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-primary mb-3"></div>
        <p className="text-sm font-medium">Loading store catalog...</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center bg-white rounded-xl border border-dashed border-slate-300 my-8">
        <p className="text-slate-500 font-medium">No products currently available online.</p>
      </div>
    );
  }

  return (
    <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Featured Catalog</h2>
          <p className="text-xs text-slate-500 mt-0.5">Handpicked products with fast domestic shipping</p>
        </div>
        <span className="text-xs text-slate-400 font-medium">{products.length} Items</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
        {products.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
};
