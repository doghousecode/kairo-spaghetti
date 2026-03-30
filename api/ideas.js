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
        .select('data, position')
        .order('position', { ascending: true })
      if (error) throw error
      res.status(200).json(data.map(r => r.data))

    } else if (req.method === 'POST') {
      const { ideas } = req.body
      if (ideas.length > 0) {
        const { error: upsertError } = await supabase
          .from('ideas')
          .upsert(ideas.map((idea, position) => ({ id: idea.id, data: idea, position })))
        if (upsertError) throw upsertError
      }
      // Delete removed ideas
      const ids = ideas.map(i => i.id)
      const deleteQuery = supabase.from('ideas').delete()
      if (ids.length > 0) {
        await deleteQuery.not('id', 'in', `(${ids.map(id => `"${id}"`).join(',')})`)
      } else {
        await deleteQuery.neq('id', '')
      }
      res.status(200).json({ ok: true })

    } else {
      res.status(405).end()
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
