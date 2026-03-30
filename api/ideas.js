import { createClient } from '@supabase/supabase-js'

function getClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key)
}

export default async function handler(req, res) {
  try {
    const supabase = getClient()

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('ideas')
        .select('id, data, position')
        .order('position', { ascending: true })
      if (error) throw error
      const settings = data.find(r => r.id === '__settings')
      const ideas = data.filter(r => r.id !== '__settings').map(r => r.data)
      res.status(200).json({ ideas, themeMode: settings?.data?.themeMode || null })

    } else if (req.method === 'POST') {
      const { ideas, themeMode } = req.body

      // Persist themeMode as a special settings row
      await supabase.from('ideas').upsert({ id: '__settings', data: { themeMode }, position: -999 })

      if (ideas.length > 0) {
        const { error: upsertError } = await supabase
          .from('ideas')
          .upsert(ideas.map((idea, position) => ({ id: idea.id, data: idea, position })))
        if (upsertError) throw upsertError
      }
      // Delete removed ideas (exclude the settings row)
      const ids = [...ideas.map(i => i.id), '__settings']
      await supabase.from('ideas').delete().not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`)
      res.status(200).json({ ok: true })

    } else {
      res.status(405).end()
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
