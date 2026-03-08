import { Router, type Request } from 'express';
import { z } from 'zod';
import { createInventory, deleteInventory, listInventory, updateInventoryDetails, updateStatus } from '../repository/inventoryRepository.js';
import { countFamilyMembers } from '../repository/collaborationRepository.js';

const createSchema = z.object({
  product_name: z.string().min(1),
  category: z.string().min(1),
  barcode: z.string().optional(),
  image_url: z.string().optional(),
  status: z.enum(['In_List', 'At_Home']),
  expiry_date: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

const statusSchema = z.object({ status: z.enum(['In_List', 'At_Home']) });

const updateDetailsSchema = z.object({
  product_name: z.string().min(1),
  category: z.string().min(1),
  barcode: z.string().optional(),
  image_url: z.string().optional(),
  expiry_date: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
});

export const inventoryRouter = Router();

function ensureCanMutateInventory(req: Request) {
  if (!req.auth) return { allowed: false as const, status: 401, message: 'Unauthorized' };

  if (req.auth.role === 'viewer') {
    return { allowed: false as const, status: 403, message: 'Viewer role cannot modify inventory.' };
  }

  return { allowed: true as const };
}

async function ensurePremiumForSharedInventory(req: Request) {
  if (!req.auth) return { allowed: false as const, status: 401, message: 'Unauthorized' };

  const memberCount = await countFamilyMembers(req.auth.familyId);
  if (memberCount > 1 && req.auth.subscriptionTier !== 'Premium') {
    return {
      allowed: false as const,
      status: 402,
      message: 'Shared inventory updates require Premium (₪40/month per user, cancel anytime).',
    };
  }

  return { allowed: true as const };
}

inventoryRouter.get('/', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const data = await listInventory(req.auth.familyId);
  return res.json(data);
});

inventoryRouter.post('/', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const roleGate = ensureCanMutateInventory(req);
  if (!roleGate.allowed) return res.status(roleGate.status).json({ error: roleGate.message });

  const premiumGate = await ensurePremiumForSharedInventory(req);
  if (!premiumGate.allowed) return res.status(premiumGate.status).json({ error: premiumGate.message });

  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const created = await createInventory({ ...parsed.data, family_id: req.auth.familyId });
  return res.status(201).json(created);
});

inventoryRouter.patch('/:id/status', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const roleGate = ensureCanMutateInventory(req);
  if (!roleGate.allowed) return res.status(roleGate.status).json({ error: roleGate.message });

  const premiumGate = await ensurePremiumForSharedInventory(req);
  if (!premiumGate.allowed) return res.status(premiumGate.status).json({ error: premiumGate.message });

  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  await updateStatus(req.params.id, req.auth.familyId, parsed.data.status);
  return res.status(204).send();
});

inventoryRouter.patch('/:id', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const roleGate = ensureCanMutateInventory(req);
  if (!roleGate.allowed) return res.status(roleGate.status).json({ error: roleGate.message });

  const premiumGate = await ensurePremiumForSharedInventory(req);
  if (!premiumGate.allowed) return res.status(premiumGate.status).json({ error: premiumGate.message });

  const parsed = updateDetailsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await updateInventoryDetails(req.params.id, req.auth.familyId, parsed.data);
  return res.json(updated);
});

inventoryRouter.delete('/:id', async (req, res) => {
  if (!req.auth) return res.status(401).json({ error: 'Unauthorized' });

  const roleGate = ensureCanMutateInventory(req);
  if (!roleGate.allowed) return res.status(roleGate.status).json({ error: roleGate.message });

  const premiumGate = await ensurePremiumForSharedInventory(req);
  if (!premiumGate.allowed) return res.status(premiumGate.status).json({ error: premiumGate.message });

  await deleteInventory(req.params.id, req.auth.familyId);
  return res.status(204).send();
});
