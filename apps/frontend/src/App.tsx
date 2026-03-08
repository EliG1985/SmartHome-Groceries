import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layout } from './components/Layout';
import { ShoppingListPanel } from './components/ShoppingListPanel';
import { PantryPanel } from './components/PantryPanel';
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
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const user = useSelector((state: RootState) => state.auth.user);

  const [activeTab, setActiveTab] = useState<'list' | 'inventory' | 'chat' | 'store' | 'reports' | 'participants' | 'settings'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [selectedListItemIds, setSelectedListItemIds] = useState<string[]>([]);
  const [listItems] = useState<InventoryItem[]>([]);
  const [pantryItems] = useState<InventoryItem[]>([]);

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
      <Layout activeTab={activeTab} onTabChange={setActiveTab} backgroundSkin={'default'}>
        <div>
          {/* Main panels */}
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
          {/* Floating Add button */}
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
        </div>
      </Layout>
    </div>
  );
}
