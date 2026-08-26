// Gardners Hub tools API — Cloudflare Worker + D1.
//
// Routed at thegardners.xyz/api/* (see wrangler.toml). Cloudflare Access
// already gates the whole hostname, so this Worker does no auth of its
// own — it trusts that only Access-authenticated requests ever reach it.
// Same-origin only: no CORS headers are sent on purpose.

const MAX_LIST_NAME = 40;
const MAX_ITEM_TEXT = 120;
const MAX_LABEL = 60;
const MAX_TIP_TEXT = 200;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(message, status = 400) {
  return json({ error: message }, status);
}

function cleanString(value, maxLen) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (e) {
    return null;
  }
}

function newId(prefix) {
  return prefix + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
}

// ---------- Shopping lists ----------

async function getShoppingLists(env) {
  const lists = await env.DB.prepare(
    'SELECT id, name FROM shopping_lists ORDER BY position ASC'
  ).all();
  const items = await env.DB.prepare(
    'SELECT id, list_id, text, done FROM shopping_items ORDER BY position ASC'
  ).all();
  const byList = new Map();
  for (const row of items.results) {
    if (!byList.has(row.list_id)) byList.set(row.list_id, []);
    byList.get(row.list_id).push({ id: row.id, text: row.text, done: !!row.done });
  }
  return json({
    lists: lists.results.map((l) => ({
      id: l.id,
      name: l.name,
      items: byList.get(l.id) || [],
    })),
  });
}

async function createShoppingList(request, env) {
  const body = await readJson(request);
  const name = body && cleanString(body.name, MAX_LIST_NAME);
  if (!name) return errorResponse('name is required (1-' + MAX_LIST_NAME + ' chars)');
  const id = newId('l');
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM shopping_lists'
  ).first();
  await env.DB.prepare('INSERT INTO shopping_lists (id, name, position) VALUES (?, ?, ?)')
    .bind(id, name, row.pos)
    .run();
  return json({ id, name, items: [] }, 201);
}

async function renameShoppingList(request, env, id) {
  const body = await readJson(request);
  const name = body && cleanString(body.name, MAX_LIST_NAME);
  if (!name) return errorResponse('name is required (1-' + MAX_LIST_NAME + ' chars)');
  const result = await env.DB.prepare('UPDATE shopping_lists SET name = ? WHERE id = ?')
    .bind(name, id)
    .run();
  if (result.meta.changes === 0) return errorResponse('list not found', 404);
  return json({ id, name });
}

async function deleteShoppingList(env, id) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM shopping_lists').first();
  if (count.n <= 1) return errorResponse('cannot delete the only list', 400);
  const existing = await env.DB.prepare('SELECT id FROM shopping_lists WHERE id = ?').bind(id).first();
  if (!existing) return errorResponse('list not found', 404);
  await env.DB.prepare('DELETE FROM shopping_items WHERE list_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM shopping_lists WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

async function addShoppingItem(request, env, listId) {
  const body = await readJson(request);
  const text = body && cleanString(body.text, MAX_ITEM_TEXT);
  if (!text) return errorResponse('text is required (1-' + MAX_ITEM_TEXT + ' chars)');
  const list = await env.DB.prepare('SELECT id FROM shopping_lists WHERE id = ?').bind(listId).first();
  if (!list) return errorResponse('list not found', 404);
  const id = newId('i');
  const row = await env.DB.prepare(
    'SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM shopping_items WHERE list_id = ?'
  ).bind(listId).first();
  await env.DB.prepare(
    'INSERT INTO shopping_items (id, list_id, text, done, position) VALUES (?, ?, ?, 0, ?)'
  ).bind(id, listId, text, row.pos).run();
  return json({ id, text, done: false }, 201);
}

async function updateShoppingItem(request, env, id) {
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return errorResponse('invalid body');
  const sets = [];
  const binds = [];
  if (body.text !== undefined) {
    const text = cleanString(body.text, MAX_ITEM_TEXT);
    if (!text) return errorResponse('text must be 1-' + MAX_ITEM_TEXT + ' chars');
    sets.push('text = ?');
    binds.push(text);
  }
  if (body.done !== undefined) {
    if (typeof body.done !== 'boolean') return errorResponse('done must be a boolean');
    sets.push('done = ?');
    binds.push(body.done ? 1 : 0);
  }
  if (sets.length === 0) return errorResponse('nothing to update');
  binds.push(id);
  const result = await env.DB.prepare('UPDATE shopping_items SET ' + sets.join(', ') + ' WHERE id = ?')
    .bind(...binds)
    .run();
  if (result.meta.changes === 0) return errorResponse('item not found', 404);
  return json({ ok: true });
}

async function deleteShoppingItem(env, id) {
  const result = await env.DB.prepare('DELETE FROM shopping_items WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return errorResponse('item not found', 404);
  return json({ ok: true });
}

async function clearCheckedItems(env, listId) {
  const list = await env.DB.prepare('SELECT id FROM shopping_lists WHERE id = ?').bind(listId).first();
  if (!list) return errorResponse('list not found', 404);
  await env.DB.prepare('DELETE FROM shopping_items WHERE list_id = ? AND done = 1').bind(listId).run();
  return json({ ok: true });
}

// ---------- Countdowns ----------

async function getCountdowns(env) {
  const rows = await env.DB.prepare(
    'SELECT id, label, target FROM countdowns ORDER BY position ASC'
  ).all();
  return json({ countdowns: rows.results });
}

async function createCountdown(request, env) {
  const body = await readJson(request);
  const label = body && cleanString(body.label, MAX_LABEL);
  const target = body && typeof body.target === 'string' && body.target.trim();
  if (!label) return errorResponse('label is required (1-' + MAX_LABEL + ' chars)');
  if (!target) return errorResponse('target is required');
  const id = newId('c');
  const row = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM countdowns').first();
  await env.DB.prepare('INSERT INTO countdowns (id, label, target, position) VALUES (?, ?, ?, ?)')
    .bind(id, label, target, row.pos)
    .run();
  return json({ id, label, target }, 201);
}

async function updateCountdown(request, env, id) {
  const body = await readJson(request);
  if (!body || typeof body !== 'object') return errorResponse('invalid body');
  const sets = [];
  const binds = [];
  if (body.label !== undefined) {
    const label = cleanString(body.label, MAX_LABEL);
    if (!label) return errorResponse('label must be 1-' + MAX_LABEL + ' chars');
    sets.push('label = ?');
    binds.push(label);
  }
  if (body.target !== undefined) {
    const target = typeof body.target === 'string' && body.target.trim();
    if (!target) return errorResponse('target must be a non-empty string');
    sets.push('target = ?');
    binds.push(target);
  }
  if (sets.length === 0) return errorResponse('nothing to update');
  binds.push(id);
  const result = await env.DB.prepare('UPDATE countdowns SET ' + sets.join(', ') + ' WHERE id = ?')
    .bind(...binds)
    .run();
  if (result.meta.changes === 0) return errorResponse('countdown not found', 404);
  return json({ ok: true });
}

async function deleteCountdown(env, id) {
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM countdowns').first();
  if (count.n <= 1) return errorResponse('cannot delete the only countdown', 400);
  const result = await env.DB.prepare('DELETE FROM countdowns WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return errorResponse('countdown not found', 404);
  return json({ ok: true });
}

// ---------- House tips ----------

async function getTips(env) {
  const rows = await env.DB.prepare('SELECT id, text FROM house_tips ORDER BY position ASC').all();
  return json({ tips: rows.results });
}

async function createTip(request, env) {
  const body = await readJson(request);
  const text = body && cleanString(body.text, MAX_TIP_TEXT);
  if (!text) return errorResponse('text is required (1-' + MAX_TIP_TEXT + ' chars)');
  const id = newId('t');
  const row = await env.DB.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM house_tips').first();
  await env.DB.prepare('INSERT INTO house_tips (id, text, position) VALUES (?, ?, ?)')
    .bind(id, text, row.pos)
    .run();
  return json({ id, text }, 201);
}

async function updateTip(request, env, id) {
  const body = await readJson(request);
  const text = body && cleanString(body.text, MAX_TIP_TEXT);
  if (!text) return errorResponse('text is required (1-' + MAX_TIP_TEXT + ' chars)');
  const result = await env.DB.prepare('UPDATE house_tips SET text = ? WHERE id = ?').bind(text, id).run();
  if (result.meta.changes === 0) return errorResponse('tip not found', 404);
  return json({ ok: true });
}

async function deleteTip(env, id) {
  const result = await env.DB.prepare('DELETE FROM house_tips WHERE id = ?').bind(id).run();
  if (result.meta.changes === 0) return errorResponse('tip not found', 404);
  return json({ ok: true });
}

// ---------- Router ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (path === '/api/shopping-lists' && method === 'GET') return await getShoppingLists(env);
      if (path === '/api/shopping-lists' && method === 'POST') return await createShoppingList(request, env);

      let m = path.match(/^\/api\/shopping-lists\/([\w-]+)$/);
      if (m && method === 'PATCH') return await renameShoppingList(request, env, m[1]);
      if (m && method === 'DELETE') return await deleteShoppingList(env, m[1]);

      m = path.match(/^\/api\/shopping-lists\/([\w-]+)\/items$/);
      if (m && method === 'POST') return await addShoppingItem(request, env, m[1]);

      m = path.match(/^\/api\/shopping-lists\/([\w-]+)\/clear-checked$/);
      if (m && method === 'POST') return await clearCheckedItems(env, m[1]);

      m = path.match(/^\/api\/shopping-items\/([\w-]+)$/);
      if (m && method === 'PATCH') return await updateShoppingItem(request, env, m[1]);
      if (m && method === 'DELETE') return await deleteShoppingItem(env, m[1]);

      if (path === '/api/countdowns' && method === 'GET') return await getCountdowns(env);
      if (path === '/api/countdowns' && method === 'POST') return await createCountdown(request, env);

      m = path.match(/^\/api\/countdowns\/([\w-]+)$/);
      if (m && method === 'PATCH') return await updateCountdown(request, env, m[1]);
      if (m && method === 'DELETE') return await deleteCountdown(env, m[1]);

      if (path === '/api/tips' && method === 'GET') return await getTips(env);
      if (path === '/api/tips' && method === 'POST') return await createTip(request, env);

      m = path.match(/^\/api\/tips\/([\w-]+)$/);
      if (m && method === 'PATCH') return await updateTip(request, env, m[1]);
      if (m && method === 'DELETE') return await deleteTip(env, m[1]);

      return errorResponse('not found', 404);
    } catch (err) {
      return errorResponse('internal error: ' + err.message, 500);
    }
  },
};
