import { useState } from 'react';
import { PasswordResetModal } from './components/PasswordResetModal';
import { useDispatch, useSelector } from 'react-redux';
import { Layout } from './components/Layout';
import { ShoppingListPanel } from './components/ShoppingListPanel';
import { PantryPanel } from './components/PantryPanel';
import SupermarketMapScreen from './components/SupermarketMapScreen';
import { EditItemModal } from './components/EditItemModal';
import { AddItemModal } from './components/AddItemModal';
import type { RootState } from './store';
import { moveItemStatus, removeItem, updateItem, addItem } from './store/slices/inventorySlice';
import type { InventoryItem } from './types/domain';
import { useLanguage } from './lib/i18n';
import { backendMode, updateInventoryStatus, updateInventoryItem } from './lib/api';
import { supabase } from './lib/supabase';
import type { AppUser } from './types/domain';

// Premium and backendMode enforcement helpers
function isPremium(user: AppUser | null) {
  return user?.subscriptionTier === 'Premium';
}
function isViewer(user: AppUser | null) {
  return user?.role === 'viewer';
}
function isSharedFamily(user: AppUser | null) {
  return user && user.familyId && user.familyId.length > 0;
}

export default function App() {
    // Search history for Map screen
    const [searchHistory, setSearchHistory] = useState<{ radius: number; location: any }[]>([]);
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const user = useSelector((state: RootState) => state.auth.user);

  const [activeTab, setActiveTab] = useState<'list' | 'inventory' | 'chat' | 'store' | 'reports' | 'participants' | 'settings' | 'map'>('list');
  // Map integration state
  const [radius, setRadius] = useState(1000);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedListItemIds, setSelectedListItemIds] = useState<string[]>([]);
  const [listItems] = useState<InventoryItem[]>([]);
  const [pantryItems] = useState<InventoryItem[]>([]);
  // Password reset modal state
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  // Handler for marking item status
  const setStatus = async (id: string, status: InventoryItem['status']) => {
    // Enforce premium and viewer gates
    if (backendMode && isViewer(user)) return;
    if (backendMode && isSharedFamily(user) && !isPremium(user)) return;
    dispatch(moveItemStatus({ id, status }));
    try {
      if (backendMode) {
        await updateInventoryStatus(id, status);
      }
    } catch (error) {
      // Handle error
    }
  };

  // Handler for deleting item
  const deleteItem = async (id: string) => {
    if (backendMode && isViewer(user)) return;
    if (backendMode && isSharedFamily(user) && !isPremium(user)) return;
    dispatch(removeItem(id));
    try {
      if (backendMode) {
        await updateInventoryItem(id, {} as any);
      }
      if (supabase) await supabase.from('inventory').delete().eq('id', id);
    } catch (error) {
      // Handle error
    }
  };

  // Handler for creating item
  const createItem = async (payload: Pick<InventoryItem, 'product_name' | 'category' | 'barcode' | 'expiry_date' | 'price' | 'quantity'>) => {
    if (backendMode && isViewer(user)) return;
    if (backendMode && isSharedFamily(user) && !isPremium(user)) return;
    try {
      dispatch(addItem(payload as InventoryItem));
      // Add backend logic if needed
    } catch (error) {
      // Handle error
    }
  };

  // Handler for editing item
  const editItemDetails = async (
    id: string,
    payload: Pick<InventoryItem, 'product_name' | 'category' | 'barcode' | 'expiry_date' | 'price' | 'quantity'>,
  ) => {
    if (backendMode && isViewer(user)) return;
    if (backendMode && isSharedFamily(user) && !isPremium(user)) return;
    const previousItem = listItems.find((item) => item.id === id);
    if (!previousItem) return;
    const optimisticItem: InventoryItem = {
      ...previousItem,
      ...payload,
    };
    dispatch(updateItem(optimisticItem));
    try {
      if (backendMode) {
        await updateInventoryItem(id, payload);
      }
      if (supabase) {
        await supabase.from('inventory').update(payload).eq('id', id);
      }
    } catch (error) {
      dispatch(updateItem(previousItem));
    }
  };

  // Selection handlers
  const toggleListItemSelection = (id: string) => {
    setSelectedListItemIds((prev) => (prev.includes(id) ? prev.filter((selectedId) => selectedId !== id) : [...prev, id]));
  };

  const toggleSelectAllListItems = () => {
    setSelectedListItemIds((prev) => (prev.length === listItems.length ? [] : listItems.map((item) => item.id)));
  };

  const deleteSelectedListItems = async () => {
    const ids = [...selectedListItemIds];
    for (const id of ids) {
      await deleteItem(id);
    }
    setSelectedListItemIds([]);
  };

  const buySelectedListItems = async () => {
    const ids = [...selectedListItemIds];
    for (const id of ids) {
      await setStatus(id, 'At_Home');
    }
    setSelectedListItemIds([]);
  };

  return (
    <div>
      <Layout activeTab={activeTab as any} onTabChange={setActiveTab} backgroundSkin={'default'}>
        <div>
          {/* Navigation buttons */}
          {user && (
            <nav style={{ display: 'flex', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
              <button onClick={() => setActiveTab('list')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'list' ? '#2196F3' : '#eee', color: activeTab === 'list' ? '#fff' : '#333' }}>List</button>
              <button onClick={() => setActiveTab('inventory')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'inventory' ? '#2196F3' : '#eee', color: activeTab === 'inventory' ? '#fff' : '#333' }}>Pantry</button>
              <button onClick={() => setActiveTab('map')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'map' ? '#2196F3' : '#eee', color: activeTab === 'map' ? '#fff' : '#333' }}>Map</button>
              <button onClick={() => setActiveTab('chat')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'chat' ? '#2196F3' : '#eee', color: activeTab === 'chat' ? '#fff' : '#333' }}>Chat</button>
              <button onClick={() => setActiveTab('store')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'store' ? '#2196F3' : '#eee', color: activeTab === 'store' ? '#fff' : '#333' }}>Store</button>
              <button onClick={() => setActiveTab('reports')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'reports' ? '#2196F3' : '#eee', color: activeTab === 'reports' ? '#fff' : '#333' }}>Reports</button>
              <button onClick={() => setActiveTab('participants')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'participants' ? '#2196F3' : '#eee', color: activeTab === 'participants' ? '#fff' : '#333' }}>Participants</button>
              <button onClick={() => setActiveTab('settings')} style={{ padding: 8, borderRadius: 8, background: activeTab === 'settings' ? '#2196F3' : '#eee', color: activeTab === 'settings' ? '#fff' : '#333' }}>Settings</button>
            </nav>
          )}
          {/* Main panels */}
          {!user && (
            <div className="login-panel flex flex-col items-center justify-center min-h-screen">
              <h2 className="mb-4 text-2xl font-bold">Login</h2>
              {/* ...login form fields here... */}
              <button className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded" onClick={() => setShowPasswordReset(true)}>
                Reset Password
              </button>
            </div>
          )}
          {user && (
            <>
              {activeTab === 'map' && (
                <div style={{ height: '100vh', width: '100vw' }}>
                  {/* Map screen integration */}
                  <SupermarketMapScreen
                    supermarkets={[]}
                    radius={radius}
                    onRefresh={() => {
                      // Add to search history
                      setSearchHistory((prev) => [{ radius, location: null }, ...prev].slice(0, 5));
                    }}
                  />
                  {/* Radius slider */}
                  <input
                    type="range"
                    min={100}
                    max={10000}
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    style={{ width: '80%', margin: '16px auto', display: 'block' }}
                  />
                  <div style={{ textAlign: 'center', marginBottom: 8 }}>
                    <button onClick={() => {
                      setSearchHistory((prev) => [{ radius, location: null }, ...prev].slice(0, 5));
                    }} style={{ padding: 8, background: '#2196F3', color: '#fff', borderRadius: 8 }}>Refresh</button>
                    <span style={{ marginLeft: 16 }}>Radius: {radius} meters</span>
                  </div>
                  {/* Search history UI */}
                  <div style={{ margin: '16px', background: '#f9f9f9', borderRadius: 8, padding: 8 }}>
                    <strong>Recent Searches:</strong>
                    <ul style={{ margin: 0, padding: 0 }}>
                      {searchHistory.map((entry, idx) => (
                        <li key={idx} style={{ padding: 4 }}>
                          <button
                            style={{ background: '#eee', border: 'none', borderRadius: 6, padding: '4px 12px', marginRight: 8 }}
                            onClick={() => setRadius(entry.radius)}
                          >
                            Radius: {entry.radius} meters
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Results list */}
                  <ul style={{ maxHeight: 200, overflowY: 'auto', margin: '0 16px', background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px #ccc' }}>
                    {([] as { name: string; address: string; distance?: number }[]).map((store, idx) => (
                      <li key={idx} style={{ padding: 8, borderBottom: '1px solid #eee' }}>
                        <strong>{store.name}</strong> — {store.address} ({store.distance ?? 0} m)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {activeTab === 'list' && (
                <ShoppingListPanel
                  items={listItems}
                  onMarkPurchased={(id) => void setStatus(id, 'At_Home')}
                  onDelete={deleteItem}
                  onEdit={setEditingItem}
                  selectedIds={selectedListItemIds}
                  onToggleSelect={toggleListItemSelection}
                  onToggleSelectAll={toggleSelectAllListItems}
                  onDeleteSelected={() => void deleteSelectedListItems()}
                  onBuySelected={() => void buySelectedListItems()}
                />
              )}
              {activeTab === 'inventory' && (
                <PantryPanel items={pantryItems} onMoveToList={(id) => void setStatus(id, 'In_List')} onEdit={setEditingItem} />
              )}
              {activeTab === 'chat' && (
                <div>Chat panel coming soon</div>
              )}
              {activeTab === 'store' && (
                <div>Store panel coming soon</div>
              )}
              {activeTab === 'reports' && (
                <div>Reports panel coming soon</div>
              )}
              {activeTab === 'participants' && (
                <div>Participants panel coming soon</div>
              )}
              {activeTab === 'settings' && (
                <div>Settings panel coming soon</div>
              )}
              {(activeTab === 'list' || activeTab === 'inventory') && (
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="app-fab fixed bottom-24 right-4 grid h-14 w-14 place-items-center rounded-full bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-100 transition hover:bg-indigo-700 lg:bottom-6"
                  aria-label={t('add.title')}
                >
                  +
                </button>
              )}
              {/* Modals */}
              <div>
                <AddItemModal
                  open={isModalOpen}
                  onClose={() => setIsModalOpen(false)}
                  supermarket={''}
                  onCreate={(payload) => { createItem(payload); }}
                />
                <EditItemModal
                  open={Boolean(editingItem)}
                  item={editingItem}
                  onClose={() => setEditingItem(null)}
                  onSave={(payload) => {
                    if (!editingItem) return;
                    editItemDetails(editingItem.id, payload);
                  }}
                />
              </div>
            </>
          )}
          {showPasswordReset && (
            <PasswordResetModal onClose={() => setShowPasswordReset(false)} />
          )}
        </div>
      </Layout>
    </div>
  );
}
