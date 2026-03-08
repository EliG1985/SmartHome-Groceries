import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseAdmin = url && serviceRoleKey ? createClient(url, serviceRoleKey) : null;
export const supabaseAuth = url && anonKey ? createClient(url, anonKey) : null;
