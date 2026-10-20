import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatPKR } from '@etimad/ui';

export const ProductsManager = () => {
  const { authFetch } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    costPrice: '',
    retailPrice: '',
    stock: '',
    category: 'Electronics',
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/v1/products');
      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await authFetch('/api/v1/products', {
        method: 'POST',
        body: JSON.stringify({
          name: newProduct.name.trim(),
          sku: newProduct.sku.trim(),
          pricing: {
            costPrice: Number(newProduct.costPrice) || 0,
            retailPrice: Number(newProduct.retailPrice) || 0,
          },
          stock: Number(newProduct.stock) || 0,
          category: newProduct.category,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to create product');
      }

      setShowAddModal(false);
      setNewProduct({ name: '', sku: '', costPrice: '', retailPrice: '', stock: '', category: 'Electronics' });
      fetchProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden bg-slate-100">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">Product & Inventory Catalog</h2>
          <p className="text-xs text-slate-500">Authoritative inventory balances and multi-channel pricing</p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow transition-all"
        >
          + Add New Product
        </button>
      </div>

      <div className="flex-1 mt-4 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
          <span className="w-48">Product Name</span>
          <span className="w-24">SKU</span>
          <span className="w-24 text-right">Cost</span>
          <span className="w-24 text-right">Retail</span>
          <span className="w-20 text-center">Stock</span>
          <span className="w-24 text-center">Status</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading catalog...</div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400">No products added yet.</div>
          ) : (
            products.map((p) => (
              <div key={p._id} className="flex items-center justify-between p-3 text-xs">
                <div className="w-48">
                  <p className="font-bold text-slate-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-slate-400">{p.category || 'General'}</p>
                </div>
                <span className="w-24 font-mono text-slate-500">{p.sku}</span>
                <span className="w-24 text-right text-slate-600">{formatPKR(p.pricing?.costPrice)}</span>
                <span className="w-24 text-right font-bold text-slate-900">{formatPKR(p.pricing?.retailPrice)}</span>
                <span className="w-20 text-center font-bold text-slate-800">{p.stock}</span>
                <div className="w-24 text-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.stock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {p.stock > 0 ? 'In Stock' : 'Out of Stock'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-800 text-sm">Add Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-3">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Item Code *</label>
                <input
                  type="text"
                  required
                  value={newProduct.sku}
                  onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    value={newProduct.costPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, costPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Retail Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    value={newProduct.retailPrice}
                    onChange={(e) => setNewProduct({ ...newProduct, retailPrice: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Opening Stock</label>
                <input
                  type="number"
                  value={newProduct.stock}
                  onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md transition-all"
                >
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

