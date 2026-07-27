// 每次调用现读 env（而不是模块顶层常量），让测试可以用 vi.stubEnv 覆盖。
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
