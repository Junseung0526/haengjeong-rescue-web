const TOKEN_KEY = 'token'
export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY))

export class ApiError extends Error {
  constructor(status, detail) {
    super(formatDetail(detail) || `요청 실패 (${status})`)
    this.status = status
    this.detail = detail
  }
}

// FastAPI detail: 문자열 | [{loc,msg}] | 객체
function formatDetail(d) {
  if (!d) return ''
  if (typeof d === 'string') return d
  if (Array.isArray(d)) return d.map((e) => (e.loc ? `${e.loc.filter((x) => x !== 'body').join('.')}: ${e.msg}` : formatDetail(e))).join('\n')
  if (d.message) return d.message
  if (d.detail) return formatDetail(d.detail)
  return JSON.stringify(d)
}

export const qs = (params = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return p.length ? '?' + new URLSearchParams(p).toString() : ''
}

async function request(method, path, body, { raw } = {}) {
  const headers = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload = body
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(path, { method, headers, body: payload })
  if (res.status === 401 && token) {
    setToken(null)
    window.dispatchEvent(new Event('auth:expired'))
  }
  if (!res.ok) {
    let detail
    try { detail = (await res.json()).detail } catch { /* 본문 없음 */ }
    throw new ApiError(res.status, detail)
  }
  if (raw) return res
  if (res.status === 204) return null
  const type = res.headers.get('content-type') || ''
  return type.includes('json') ? res.json() : res.text()
}

export const api = {
  get: (path, params) => request('GET', path + qs(params)),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  // 파일 응답을 받아 브라우저 저장
  async download(path, body, method = body ? 'POST' : 'GET') {
    const res = await request(method, path, body, { raw: true })
    const cd = res.headers.get('content-disposition') || ''
    const m = cd.match(/filename\*=UTF-8''([^;]+)/) || cd.match(/filename="?([^";]+)/)
    const name = m ? decodeURIComponent(m[1]) : 'download'
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), { href: url, download: name })
    a.click()
    URL.revokeObjectURL(url)
    return { name, res }
  },
}

export const form = (obj) => {
  const fd = new FormData()
  Object.entries(obj).forEach(([k, v]) => v !== undefined && v !== null && v !== '' && fd.append(k, v))
  return fd
}
