import { supabase } from './supabaseClient';

export type CloudQueue = {
  id: string; name: string; slug: string; prefix: string;
  current_number: number; next_number: number;
  estimated_minutes_per_person: number; is_active: boolean; is_paused: boolean; scheduled_for?: string | null;
  business_id: string;
};
export type CloudBusiness = { id:string; name:string; owner_id:string };
export type CloudVisitor = {
  id:string; queue_id:string; queue_number:number; customer_token:string;
  customer_name:string|null; customer_phone:string|null; status:string; joined_at:string;
};

export async function findPublicQueue(queueSlug:string, businessSlug:string) {
  if (!supabase) return null;
  const { data: queues, error } = await supabase.from('queues').select('*').eq('slug', queueSlug).eq('is_active', true).limit(1);
  if (error || !queues?.length) return null;
  const q = queues[0] as CloudQueue;
  const { data: business } = await supabase.from('businesses').select('id,name').eq('id', q.business_id).limit(1).maybeSingle();
  if (!business || (businessSlug && business.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') !== businessSlug)) return null;
  return { queue:{...q, status:q.is_paused ? 'paused' : 'active', averageServiceMinutes:q.estimated_minutes_per_person, allowEstimatedWait:true}, business:business as CloudBusiness };
}

export async function joinCloudQueue(queueId:string,name?:string,phone?:string) {
  if (!supabase) throw new Error('Cloud service unavailable');
  const { data, error } = await supabase.rpc('join_queue',{p_queue_id:queueId,p_customer_name:name||null,p_customer_phone:phone||null});
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  // The SQL RPC returns the visitor primary key as `id`; normalize the name
  // expected by the customer view while retaining compatibility with both shapes.
  return row ? { ...row, visitor_id: row.visitor_id || row.id } : row;
}

export async function getCloudQueueStats(queueId:string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_public_queue_stats', { p_queue_id: queueId });
  if (error) {
    console.error('Could not refresh public queue stats:', error);
    return null;
  }
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function getCloudVisitor(visitorId:string, token:string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_visitor_status',{p_visitor_id:visitorId,p_customer_token:token});
  if (error || !data?.length) return null;
  return data[0];
}

export function subscribeToCloudQueue(queueId:string, callback:()=>void) {
  if (!supabase) return () => {};
  const channel=supabase.channel(`queue-db:${queueId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'queues',filter:`id=eq.${queueId}`},callback)
    .on('postgres_changes',{event:'*',schema:'public',table:'queue_visitors',filter:`queue_id=eq.${queueId}`},callback)
    .subscribe();
  return ()=>{ supabase.removeChannel(channel); };
}
