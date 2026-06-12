import { createClient } from 'jsr:@supabase/supabase-js@2'

export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('缺少 Supabase 服务端环境变量。')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export function createUserClient(authorization: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !anonKey) {
    throw new Error('缺少 Supabase 客户端环境变量。')
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  })
}

export async function requireAdminAccess(authorization: string) {
  const userClient = createUserClient(authorization)
  const [{ data: userResult, error: userError }, { data: permissionResult, error: permissionError }] = await Promise.all([
    userClient.auth.getUser(),
    userClient.rpc('has_permission', { permission_code: 'admin.access' }),
  ])

  if (userError || !userResult.user) {
    throw new Error('未登录或登录已失效。')
  }
  if (permissionError) {
    throw permissionError
  }
  if (!permissionResult) {
    throw new Error('无权管理生图供应商。')
  }

  return {
    user: userResult.user,
    userClient,
  }
}
