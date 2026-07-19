import { supabase } from './supabase'
import type { Report } from './types'
import { reportLimiter, enforceRateLimit } from './rateLimiter'

export async function createReport(
  reporterId: string,
  reason: string,
  options: {
    reportedUserId?: string
    reportedPostId?: string
    description?: string
  } = {}
) {
  enforceRateLimit(reportLimiter, `report:${reporterId}`, 'Rapporteren')
  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: reporterId,
      reported_user_id: options.reportedUserId || null,
      reported_post_id: options.reportedPostId || null,
      reason,
      description: options.description || null,
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    console.error('❌ Error creating report:', error)
    throw error
  }

  return data as Report
}

export async function hasAlreadyReported(
  reporterId: string,
  options: {
    reportedUserId?: string
    reportedPostId?: string
  }
) {
  let query = supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', reporterId)

  if (options.reportedUserId) {
    query = query.eq('reported_user_id', options.reportedUserId)
  }
  if (options.reportedPostId) {
    query = query.eq('reported_post_id', options.reportedPostId)
  }

  const { data, error } = await query.limit(1)

  if (error) {
    console.error('❌ Error checking existing report:', error)
    return false
  }

  return (data?.length ?? 0) > 0
}
