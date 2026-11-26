import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, CircleAlert, RefreshCw, FileUp, Inbox, Info, Loader2, Paperclip, Search, X } from 'lucide-react'
import { api } from './api'

export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

/* ---------- 데이터 ---------- */
// path가 null이면 요청하지 않는다. params가 바뀌면 다시 불러온다.
export function useApi(path, params) {
  const key = path ? path + JSON.stringify(params || {}) : null
  const [state, setState] = useState({ data: null, error: null, loading: !!path })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) return setState({ data: null, error: null, loading: false })
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    api.get(path, params).then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false }),
    )
    return () => { alive = false }
  }, [key, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  return { ...state, reload: useCallback(() => setTick((t) => t + 1), []) }
}

/* ---------- 포맷 ---------- */
export const won = (v) => (v === null || v === undefined || v === '' ? '-' : `${Number(v).toLocaleString('ko-KR')}원`)
export const num = (v) => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('ko-KR'))
export const date = (v) => (v ? String(v).slice(0, 10) : '-')
export const dt = (v) => (v ? new Date(v).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' }) : '-')
export const today = () => new Date().toLocaleDateString('sv-SE')
export const thisMonth = () => today().slice(0, 7)

export const LABEL = {
  active: ['재직', 'green'], exited: ['퇴사', ''], waiting: ['대기', 'yellow'],
  draft: ['임시저장', ''], submitted: ['제출', 'blue'], approved: ['승인', 'green'], rejected: ['반려', 'red'],
  not_submitted: ['미제출', 'yellow'], overdue: ['기한 초과', 'red'],
  confirmed: ['확정', 'green'], needs_review: ['확인 필요', 'yellow'], other_project: ['타 사업', ''],
  awaiting_integration: ['연계 대기', 'yellow'], pending: ['처리 대기', 'blue'], completed: ['완료', 'green'], duplicate_resolved: ['중복 종결', ''],
  calculated: ['계산 완료', 'blue'], payment_blocked: ['지급 차단', 'red'], paid: ['지급 완료', 'green'],
  present: ['출근', 'green'], early_leave: ['조퇴', 'yellow'], annual_leave: ['연차', 'blue'], absent: ['결근', 'red'],
  unsigned: ['미서명', 'yellow'], signed: ['서명 완료', 'green'], resign_required: ['재서명 필요', 'red'], unmatched: ['불일치', 'red'],
  stale: ['재계산 필요', 'red'], join: ['입사 정산', 'blue'], exit: ['퇴사 정산', ''],
  matched: ['일치', 'green'], mismatched: ['불일치', 'red'], unreadable: ['미판독', 'yellow'],
}
export const ROLE = {
  system_admin: '시스템 관리자', payroll_officer: '인건비 담당자', department_head: '부서장', department_staff: '부서 담당자', viewer: '조회자',
}
export const INSURANCE = { national_pension: '국민연금', health: '건강보험', long_term_care: '장기요양', employment: '고용보험', industrial_accident: '산재보험' }
// 탭·필터·검색을 주소(?tab=…)에 담아 새로고침·뒤로가기·링크 공유 때도 그대로 보이게 한다
export function useUrlState(key, fallback = '') {
  const [sp, setSp] = useSearchParams()
  const value = sp.get(key) ?? fallback
  const set = (v) => setSp((p) => {
    const n = new URLSearchParams(p)
    if (v === fallback) n.delete(key); else n.set(key, v)
    if (key === 'tab') n.delete('q') // 탭을 바꾸면 다른 목록이므로 검색어는 비운다
    return n
  }, { replace: true })
  return [value, set]
}

// 서버가 영어 코드로 주는 값의 한글 이름
export const JOB_STATE = { PENDING: '대기 중', RECEIVED: '접수됨', STARTED: '판독 중', PROGRESS: '판독 중', RETRY: '다시 시도 중', SUCCESS: '완료', FAILURE: '실패', REVOKED: '취소됨' }
export const RECALC_REASON = {
  attendance_changed: '출결 변경', participation_changed: '참여 정보 변경', placement_changed: '부서 배치 변경',
  payroll_rule_changed: '계산 규칙 변경', insurance_changed: '보험료 변경', attendance_check_period_changed: '출결 확인 기간 변경',
  previous_annual_leave_changed: '전월 연차 변경', previous_payroll_needs_recalculation: '전월 계산 재계산 필요',
}
export const label = (map, code) => map[code] || code

export const WORK_KIND = { calculation: '급여 계산', file_generation: '파일 생성', salary_payment: '급여 지급', insurance_payment: '보험료 납부', external_report: '외부 신고', refund: '환급' }

// tone을 직접 주려면 v에 없는 값 + tone
export function Badge({ v, tone, children }) {
  const [text, t] = LABEL[v] || [children ?? v ?? '-', '']
  return <span className={`badge ${tone ?? t}`}>{children ?? text}</span>
}

export const Person = ({ name, sub }) => (
  <span className="name"><span className="avatar">{name?.[0] || '?'}</span><span>{name}{sub && <div className="mono" style={{ fontWeight: 400 }}>{sub}</div>}</span></span>
)

/* ---------- 모션 ---------- */
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// "1,234" 같은 숫자 문자열을 이전 값에서 새 값까지 굴려 보여준다. 숫자가 아니면 그대로.
export function CountUp({ value }) {
  const target = typeof value === 'number' ? value : /^-?[\d,]+(\.\d+)?$/.test(String(value ?? '')) ? Number(String(value).replaceAll(',', '')) : null
  const [shown, setShown] = useState(target ?? 0)
  const [bump, setBump] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (target === null) return
    const start = from.current
    if (start !== target && from.current !== 0) setBump((b) => b + 1)
    from.current = target
    if (reduced()) return setShown(target)
    let raf, t0
    const step = (t) => {
      t0 ??= t
      const k = Math.min((t - t0) / 700, 1)
      setShown(start + (target - start) * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  if (target === null) return value ?? '-'
  const dec = String(target).includes('.') ? 1 : 0
  return <span key={bump} className={bump ? 'bump' : undefined}>{shown.toLocaleString('ko-KR', { maximumFractionDigits: dec, minimumFractionDigits: dec })}</span>
}

// 실시간 표시: 마지막 갱신 후 몇 초 지났는지 + 새로고침 버튼
export function Live({ at, onRefresh, busy }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t) }, [])
  const sec = Math.max(0, Math.round((Date.now() - at) / 1000))
  return (
    <span className="live" aria-live="off">
      <span className="live-dot" />실시간 · {sec < 5 ? '방금' : sec < 60 ? `${sec}초 전` : `${Math.floor(sec / 60)}분 전`}
      {onRefresh && <button onClick={onRefresh} aria-label="지금 새로고침" title="지금 새로고침"><RefreshCw size={13} className={busy ? 'spin' : ''} /></button>}
    </span>
  )
}

// n밀리초마다 fn 실행 (탭이 안 보이면 쉼)
export function useInterval(fn, ms) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && ref.current(), ms)
    return () => clearInterval(t)
  }, [ms])
}

/* ---------- 로고 ---------- */
// 서류 + 검증 체크: 취합·검증이라는 핵심 기능을 그대로 표현한다. 파란 타일은 .brand-mark 가 그린다.
export function Logo({ className = '' }) {
  return (
    <div className={`brand-mark ${className}`} role="img" aria-label="행정 구조대">
      <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
        <rect x="13" y="8" width="15" height="19" rx="2.5" fill="none" stroke="#fff" strokeWidth="1.6" opacity=".5" />
        <rect x="10" y="11" width="15" height="20" rx="2.5" fill="#2f6fe8" stroke="#fff" strokeWidth="2.4" />
        <path d="M13.5 16.8H21.5M13.5 21H19" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="26.5" cy="27" r="6.3" fill="#fff" />
        <path d="M23.7 27l2.1 2.1 3.5-3.9" fill="none" stroke="#1f5fd8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

/* ---------- 레이아웃 조각 ---------- */
export function PageHead({ tag, title, desc, children }) {
  return (
    <div className="page-head">
      <div>
        {tag && <span className="tag">{tag}</span>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  )
}

export function Card({ title, count, actions, children, pad, style }) {
  return (
    <section className="card" style={style}>
      {(title || actions) && (
        <div className="card-head">
          <h2>{title}{count !== undefined && count !== null && <span className="count">{count}</span>}</h2>
          {actions && <div className="actions">{actions}</div>}
        </div>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  )
}

// tone: blue|green|red|yellow|gray, to: 링크, bar: [[값, tone], ...]
export function Stat({ label, value, unit, hint, attn, icon: Icon, tone = 'blue', to, bar, loading }) {
  const body = (
    <>
      <div className="stat-top">
        <span className="label">{label}</span>
        {Icon && <span className={`stat-icon ${attn ? 'red' : tone}`}><Icon size={18} /></span>}
      </div>
      <div className="value">{loading && (value == null || value === '-') ? <div className="skel" style={{ width: 80, height: 28 }} /> : <><CountUp value={value} />{unit && <small>{unit}</small>}</>}</div>
      {bar && <Bar parts={bar} />}
      {hint && <div className="hint">{hint}</div>}
    </>
  )
  const cls = `card stat${attn ? ' attn' : ''}`
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>
}

export function Bar({ parts }) {
  const total = parts.reduce((s, [v]) => s + (Number(v) || 0), 0)
  return (
    <div className="bar" role="img" aria-label={parts.map(([v, , l]) => `${l || ''} ${v}`).join(', ')}>
      {total > 0 && parts.map(([v, t], i) => <i key={i} className={t} style={{ width: `${(100 * (Number(v) || 0)) / total}%` }} />)}
    </div>
  )
}

// 선택 표시(밑줄·바탕)가 고른 항목으로 미끄러져 가도록 위치를 잰다
function useInk(value) {
  const ref = useRef(null)
  const [ink, setInk] = useState(null)
  useLayoutEffect(() => {
    const on = ref.current?.querySelector(':scope > .on')
    if (!on) return setInk(null)
    const update = () => setInk({ x: on.offsetLeft, w: on.offsetWidth })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(on)
    return () => ro.disconnect()
  }, [value])
  const style = ink && { transform: `translateX(${ink.x}px)`, width: ink.w }
  return [ref, style]
}

export function Tabs({ tabs, value, onChange }) {
  const [ref, ink] = useInk(value)
  return (
    <div className={`tabs${ink ? ' inked' : ''}`} role="tablist" ref={ref}>
      {ink && <i className="ink" style={ink} aria-hidden="true" />}
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{label}</button>
      ))}
    </div>
  )
}

export function Seg({ options, value, onChange, label }) {
  const [ref, ink] = useInk(value)
  return (
    <div className={`seg${ink ? ' inked' : ''}`} role="radiogroup" aria-label={label} ref={ref}>
      {ink && <i className="ink" style={ink} aria-hidden="true" />}
      {options.map(([k, l]) => <button key={k} role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  )
}

const ALERT_ICON = { error: CircleAlert, warn: AlertTriangle, info: Info, success: Info }
export function Alert({ type = 'info', children, style }) {
  const I = ALERT_ICON[type]
  return <div className={`alert ${type}`} style={style}><I size={17} /><div style={{ whiteSpace: 'pre-line' }}>{children}</div></div>
}
export const ErrorBox = ({ error }) => (error ? <Alert type="error">{error.message || String(error)}</Alert> : null)

export function Empty({ title = '표시할 내용이 없습니다.', hint, icon: I = Inbox }) {
  return <div className="empty"><div className="empty-icon"><I size={24} /></div><b>{title}</b>{hint && <span>{hint}</span>}</div>
}

/* ---------- 표 ---------- */
// columns: [{ key, label, render(row), num, sort?: false }]
// search: 검색창 표시 (행이 많으면 자동), tools: 검색창 옆 추가 요소
// 코드 → 이름 목록. 한 번만 불러와 모든 화면이 같이 쓴다
// shortcut: 부서는 코드만으로 찾으므로 사업이 달라도 코드가 같으면 같은 이름이 나온다. 겹치는 코드가 생기면 사업 코드까지 키로 쓸 것
const nameCache = {}
const toMap = (list, k, n) => Object.assign(new Map((list || []).map((d) => [d[k], d[n]])), { list: list || [] })
export const resetNames = () => { for (const k in nameCache) delete nameCache[k] }
export const resetDeptNames = resetNames
function useCached(key, load) {
  const [v, setV] = useState(null)
  useEffect(() => {
    nameCache[key] ||= load().catch(() => { delete nameCache[key]; return null })
    let live = true
    nameCache[key].then((x) => live && setV(x))
    return () => { live = false }
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return v
}
// 부서 이름 Map. 사업 이름은 .projects에 함께 담는다
export const useDeptNames = () => useCached('dept', () => Promise.all([api.get('/api/departments'), api.get('/api/projects').catch(() => [])])
  .then(([d, pr]) => Object.assign(toMap(d, 'department_code', 'department_name'), { projects: toMap(pr, 'project_code', 'project_name') })))
export const useAgencyNames = () => useCached('agency', () => api.get('/api/agencies').then((l) => toMap(l, 'agency_code', 'agency_name')))
export const projName = (depts, code) => depts?.projects?.get(code) ?? code

// 폼에서 코드를 직접 치지 않고 이름으로 고르게 한다. 목록을 아직 못 불러왔으면 입력칸으로 둔다
export function deptField(depts, project, f = {}) {
  const list = (depts?.list || []).filter((d) => !project || d.project_code === project)
  const base = { name: 'department_code', label: '부서', ...f }
  if (!list.length) return base
  return { ...base, type: 'select', options: list.map((d) => [d.department_code, project ? d.department_name : `${d.department_name} (${projName(depts, d.project_code)})`]) }
}
export function projectField(depts, f = {}) {
  const list = [...new Set([...(depts?.projects?.list || []).map((p) => p.project_code), ...(depts?.list || []).map((d) => d.project_code)])].sort()
  const base = { name: 'project_code', label: '사업', ...f }
  return list.length ? { ...base, type: 'select', options: list.map((p) => [p, projName(depts, p)]) } : base
}

export function Dept({ code }) {
  const name = useDeptNames()?.get(code)
  if (!code) return '-'
  return name ? <span title={code}>{name}</span> : code
}

export function Table({ columns, rows, loading, error, onRow, empty = '표시할 내용이 없습니다.', emptyHint, emptyIcon, search, tools }) {
  const [q, setQ] = useUrlState('q')
  const [sort, setSort] = useState(null) // [key, dir]
  const showTools = search ?? (rows?.length > 8 || !!tools)
  const depts = useDeptNames()
  const agencies = useAgencyNames()
  // 코드 열은 이름으로 보이고, 검색·정렬도 이름 기준
  const nameOf = (k, code) => (k === 'department_code' ? depts?.get(code) : k === 'project_code' ? depts?.projects?.get(code) : k === 'agency_code' ? agencies?.get(code) : undefined)

  const view = useMemo(() => {
    let r = rows || []
    if (q) {
      const needle = q.toLowerCase()
      r = r.filter((row) => columns.some((c) => c.key && `${row[c.key] ?? ''} ${nameOf(c.key, row[c.key]) ?? ''}`.toLowerCase().includes(needle)))
    }
    if (sort) {
      const [k, d] = sort
      r = [...r].sort((a, b) => {
        // 부서는 코드가 아니라 화면에 보이는 이름 순으로
        const name = (v) => nameOf(k, v) ?? v
        const x = name(a[k]), y = name(b[k])
        const nx = Number(x), ny = Number(y)
        const c = x !== null && y !== null && x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x ?? '').localeCompare(String(y ?? ''), 'ko')
        return d * c
      })
    }
    return r
  }, [rows, q, sort, columns, depts, agencies]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="card-body"><ErrorBox error={error} /></div>
  const toggle = (c) => {
    if (c.sort === false || !c.key || !rows?.length || !(c.key in rows[0])) return
    setSort((s) => (s?.[0] !== c.key ? [c.key, 1] : s[1] === 1 ? [c.key, -1] : null))
  }

  return (
    <>
      {showTools && (
        <div className="table-tools">
          <div className="search"><Search size={15} /><input className="input sm" placeholder="표 안에서 검색" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() } }} aria-label="표 검색 (단축키 /)" /><kbd className="slash" aria-hidden="true">/</kbd></div>
          {tools}
          <span className="muted">{q ? `${view.length} / ${rows?.length ?? 0}건` : `${rows?.length ?? 0}건`}</span>
        </div>
      )}
      {loading && !rows ? (
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          {[80, 65, 90, 70, 55].map((w, i) => <div key={i} className="skel" style={{ width: `${w}%` }} />)}
        </div>
      ) : !view.length ? (
        <Empty title={q ? '검색 결과가 없습니다.' : empty} hint={q ? null : emptyHint} icon={emptyIcon} />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((c) => {
                  const sortable = c.sort !== false && c.key && rows?.length && c.key in rows[0]
                  const on = sort?.[0] === c.key
                  const A = on ? (sort[1] === 1 ? ArrowUp : ArrowDown) : ArrowUpDown
                  return (
                    <th key={c.key || c.label} className={`${c.num ? 'num' : ''}${sortable ? ' sortable' : ''}${on ? ' sorted' : ''}`} onClick={() => toggle(c)}
                      aria-sort={on ? (sort[1] === 1 ? 'ascending' : 'descending') : undefined}>
                      {c.label}{sortable && c.label && <span className="arrow"><A size={13} /></span>}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {view.map((r, i) => (
                <tr key={r.id || r.participation_id || i} style={{ '--i': i }} className={onRow ? 'click' : ''} onClick={onRow ? () => onRow(r) : undefined}
                  tabIndex={onRow ? 0 : undefined} onKeyDown={onRow ? (e) => e.key === 'Enter' && onRow(r) : undefined}>
                  {columns.map((c) => (
                    <td key={c.key || c.label} className={c.num ? 'num' : ''}>{c.render ? c.render(r) : nameOf(c.key, r[c.key]) ? <span title={r[c.key]}>{nameOf(c.key, r[c.key])}</span> : (r[c.key] ?? '-')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

// 행 안의 버튼 묶음: 클릭이 행 클릭으로 번지지 않게
export const RowActions = ({ children }) => <div className="actions row-actions" onClick={(e) => e.stopPropagation()}>{children}</div>

/* ---------- 모달·드로어 ---------- */
// wide면 오른쪽에서 열리는 드로어
export function Modal({ title, sub, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  // 화면 진입 애니메이션(transform)이 걸린 부모 안에서는 position:fixed가 부모 기준이 되므로 body에 그린다
  return createPortal(
    <div className={`overlay${wide ? ' drawer' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2>{title}</h2>{sub && <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{sub}</div>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  , document.body)
}

/* ---------- 폼 ---------- */
export function Dropzone({ value, onChange, accept, required, id }) {
  const [over, setOver] = useState(false)
  const pick = (f) => f && onChange(f)
  return (
    <label className={`drop${over ? ' over' : ''}${value ? ' has' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]) }}>
      <input id={id} type="file" accept={accept} required={required && !value} onChange={(e) => pick(e.target.files[0])} />
      {value ? (
        <><Paperclip size={20} /><b>{value.name}</b><small>{(value.size / 1024).toFixed(0)} KB · 눌러서 바꾸기</small></>
      ) : (
        <><FileUp size={22} /><span><b>파일을 끌어다 놓거나</b> 눌러서 선택</span>{accept && <small>{accept.replaceAll(',', ' · ')}</small>}</>
      )}
    </label>
  )
}

// field: { name, label, type?, required?, options?: [[value,label]], hint?, full?, placeholder? }
export function Field({ f, value, onChange }) {
  const common = { id: f.name, name: f.name, required: f.required, className: 'input', placeholder: f.placeholder }
  let input
  if (f.type === 'select') {
    input = (
      <select {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {!f.required && <option value="">선택 안 함</option>}
        {f.required && (value ?? '') === '' && <option value="">선택하세요</option>}
        {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    )
  } else if (f.type === 'textarea') {
    input = <textarea {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
  } else if (f.type === 'file') {
    return (
      <div className={`field${f.full !== false ? ' full' : ''}`}>
        <span>{f.label}{f.required && <em>*</em>}</span>
        <Dropzone id={f.name} value={value} onChange={onChange} accept={f.accept} required={f.required} />
        {f.hint && <small>{f.hint}</small>}
      </div>
    )
  } else if (f.type === 'checkbox') {
    return <label className={`check${f.full ? ' full' : ''}`}><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />{f.label}</label>
  } else {
    input = <input {...common} type={f.type || 'text'} step={f.step} value={value ?? ''} onChange={(e) => onChange(e.target.value)} autoComplete={f.type === 'password' ? 'new-password' : undefined} />
  }
  return (
    <label className={`field${f.full ? ' full' : ''}`}>
      <span>{f.label}{f.required && <em>*</em>}</span>
      {input}
      {f.hint && <small>{f.hint}</small>}
    </label>
  )
}

// onSubmit(values) 가 성공하면 닫고, 반환 문자열을 토스트로 띄운다. fields가 비면 확인 대화상자.
export function FormModal({ title, fields = [], initial = {}, onSubmit, onClose, submitLabel = '저장', intro, cols, danger }) {
  const { toast } = useApp()
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const msg = await onSubmit(values)
      toast(typeof msg === 'string' ? msg : '처리했습니다.')
      onClose()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  const list = fields.filter(Boolean)
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        {intro && <Alert type={danger ? 'warn' : 'info'}>{intro}</Alert>}
        <ErrorBox error={error} />
        {list.length > 0 && (
          <div className={`form${cols ? ' cols' : ''}`}>
            {list.map((f, i) => (
              <div key={f.name} style={{ display: 'contents' }} ref={i === 0 ? (el) => el?.querySelector('input:not([type=file]),select,textarea')?.focus() : undefined}>
                <Field f={f} value={values[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
              </div>
            ))}
          </div>
        )}
        <div className="modal-foot" style={{ margin: '20px -24px -20px' }}>
          <button type="button" className="btn" onClick={onClose}>취소</button>
          <button className={`btn ${danger ? 'danger-solid' : 'primary'}`} disabled={busy}>
            {busy && <Loader2 size={15} className="spin" />}{busy ? '처리 중…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// 모달 하나를 상태로 들고 다니는 훅: open({title, fields, onSubmit})
export function useModal() {
  const [m, setM] = useState(null)
  const el = m && <FormModal {...m} onClose={() => setM(null)} />
  return [el, setM]
}

export const REASON = { name: 'reason', label: '사유', required: true, type: 'textarea', full: true, hint: '감사 로그에 남습니다.' }
export const monthField = (name = 'work_month', label = '업무월') => ({ name, label, type: 'month', required: true })
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== undefined))
