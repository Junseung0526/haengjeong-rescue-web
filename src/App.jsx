import { Component, useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Building2, CircleHelp, CalendarCheck, CalendarClock, Calculator, CheckCircle2, ChevronRight, ClipboardCheck, Command, Eye, EyeOff,
  FileDown, FileSpreadsheet, GitCompare, KeyRound, LayoutDashboard, Loader2, LogOut, PanelLeftClose, PanelLeftOpen, ScanLine,
  ScrollText, Search, Send, ShieldAlert, ShieldCheck, Trash2, TriangleAlert, Users as UsersIcon, UserCog, Wallet, XCircle,
} from 'lucide-react'
import { api, getToken, setToken } from './api'
import { Intro, Tour, tourSeen } from './agents'
import { AppCtx, ErrorBox, Logo, FormModal, ROLE, thisMonth, useApi, useApp } from './ui'
import Dashboard from './pages/Dashboard'
import Participants from './pages/Participants'
import Submissions from './pages/Submissions'
import Ingest from './pages/Ingest'
import Validation from './pages/Validation'
import Payroll from './pages/Payroll'
import Insurance from './pages/Insurance'
import Attendance from './pages/Attendance'
import Changes from './pages/Changes'
import Deadlines from './pages/Deadlines'
import Exports from './pages/Exports'
import Settlements from './pages/Settlements'
import Ocr from './pages/Ocr'
import Notifications from './pages/Notifications'
import { Users, AuditLogs, SystemErrors, Departments, Retention } from './pages/Admin'

const NAV = [
  ['업무', [
    ['/', '현황 대시보드', 'FN-08', Dashboard, LayoutDashboard],
    ['/participants', '참여자 관리', 'FN-01', Participants, UsersIcon],
    ['/attendance', '전자출석', 'FN-12', Attendance, CalendarCheck],
  ]],
  ['자료 취합·검증', [
    ['/submissions', '부서 제출 포털', 'FN-09', Submissions, Send],
    ['/ingest', '엑셀 취합', 'FN-02', Ingest, FileSpreadsheet],
    ['/validation', '검증 오류', 'FN-05', Validation, TriangleAlert],
    ['/changes', '전월 대비 변경', 'FN-11', Changes, GitCompare],
    ['/ocr', '스캔 출석부 대조', 'FN-06', Ocr, ScanLine],
  ]],
  ['인건비·보험', [
    ['/payroll', '인건비 계산', 'FN-03', Payroll, Calculator],
    ['/settlements', '중도 입·퇴사 정산', 'FN-14', Settlements, Wallet],
    ['/insurance', '4대보험 귀속', 'FN-04', Insurance, ShieldCheck],
  ]],
  ['제출·마감', [
    ['/exports', '제출 양식 출력', 'FN-07·16', Exports, FileDown],
    ['/deadlines', '마감·독촉', 'FN-15', Deadlines, CalendarClock],
  ]],
  ['관리', [
    ['/admin/users', '계정·권한', 'NFR-09', Users, UserCog],
    ['/admin/departments', '부서', '', Departments, Building2],
    ['/admin/audit', '감사 로그', 'NFR-10', AuditLogs, ScrollText],
    ['/admin/errors', '오류 이력', 'NFR-18', SystemErrors, ShieldAlert],
    ['/admin/retention', '개인정보 파기', 'NFR-08', Retention, Trash2],
  ], ['system_admin']],
]

// 화면 하나에서 오류가 나도 앱 전체가 하얗게 죽지 않도록 화면 단위로 막는다
class PageBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error(error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card" style={{ marginTop: 24 }}>
        <div className="empty">
          <div className="empty-icon"><TriangleAlert size={24} /></div>
          <b>이 화면을 표시하는 중 문제가 생겼습니다.</b>
          <span>서버 응답 형식이 예상과 다를 수 있습니다. 다른 메뉴는 그대로 쓸 수 있습니다.</span>
          <button className="btn" style={{ marginTop: 12 }} onClick={() => this.setState({ error: null })}>다시 시도</button>
        </div>
      </div>
    )
  }
}

const FEATS = [
  [FileSpreadsheet, '부서별 엑셀을 한 번에 취합하고 자동 검증'],
  [Calculator, '인건비·4대보험 귀속을 규칙대로 계산'],
  [ClipboardCheck, '마감 현황과 독촉, 제출 양식 출력까지 한 곳에서'],
]

function Login({ onLogin }) {
  const [v, setV] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api.post('/api/auth/login', v)
      setToken(r.token)
      onLogin(r.user)
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  // 마우스 위치를 CSS 변수로 넘겨 배경 불빛이 따라오게 한다
  const follow = (e) => {
    const el = e.currentTarget
    el.style.setProperty('--gx', `${e.clientX}px`)
    el.style.setProperty('--gy', `${e.clientY}px`)
  }
  return (
    <div className="auth" onPointerMove={follow}>
      <div className="auth-light" aria-hidden="true" />
      <aside className="auth-hero">
        <div>
          <div className="brand" style={{ padding: 0 }}><Logo />행정 구조대</div>
          <h2>흩어진 행정 자료를<br />한 화면에서 검증하고 마감합니다.</h2>
          <p>참여자 관리부터 인건비 계산, 4대보험 귀속, 제출 양식 출력까지 사업 행정 전 과정을 지원합니다.</p>
        </div>
        <div className="auth-feats">{FEATS.map(([I, t]) => <div key={t}><I size={18} />{t}</div>)}</div>
      </aside>
      <div className="auth-form">
        <form onSubmit={submit}>
          <div className="slogan" aria-label="부강한 진주 행복한 시민"><span className="r">부강한 진주</span> <span className="b">행복한 시민</span></div>
          <h1>로그인</h1>
          <p>발급받은 계정으로 로그인하세요.</p>
          <ErrorBox error={error} />
          <div className="form">
            <label className="field"><span>아이디</span><input className="input" autoFocus autoComplete="username" required value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} /></label>
            <label className="field"><span>비밀번호</span>
              <div className="pw">
                <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
                <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setShow(!show)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </label>
            <button className="btn primary" style={{ height: 48, marginTop: 8 }} disabled={busy}>{busy && <Loader2 size={16} className="spin" />}{busy ? '로그인 중…' : '로그인'}</button>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 24 }}>계정이 없거나 잠겼다면 시스템 관리자에게 문의하세요.</p>
        </form>
      </div>
    </div>
  )
}

function ChangePassword({ forced, onDone, onClose }) {
  return (
    <FormModal
      title={forced ? '비밀번호를 변경해 주세요' : '비밀번호 변경'}
      intro={forced ? '관리자가 만든 비밀번호는 변경한 뒤에 사용할 수 있습니다.' : '변경하면 다른 기기의 로그인은 종료됩니다.'}
      fields={[
        { name: 'current_password', label: '현재 비밀번호', type: 'password', required: true },
        { name: 'new_password', label: '새 비밀번호', type: 'password', required: true, hint: '8자 이상' },
      ]}
      submitLabel="변경"
      onSubmit={async (v) => { await api.post('/api/auth/password', v); onDone(); return '비밀번호를 변경했습니다.' }}
      onClose={onClose}
    />
  )
}

// 모든 화면이 공유하는 사업·부서·업무월
function ContextBar() {
  const { scope, setScope } = useApp()
  const { data: depts } = useApi('/api/departments')
  const projects = [...new Set((depts || []).map((d) => d.project_code))].sort()
  const deptOpts = (depts || []).filter((d) => d.project_code === scope.project_code)
  // 맡은 사업이 하나뿐이면 고를 필요 없이 바로 선택한다
  useEffect(() => {
    if (!scope.project_code && projects.length === 1) setScope({ ...scope, project_code: projects[0], department_code: '' })
  }, [projects.length]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="ctx" role="group" aria-label="조회 범위">
      <div className="ctx-item">
        <label htmlFor="ctx-p">사업</label>
        <select id="ctx-p" style={{ maxWidth: 140 }} value={scope.project_code}
          onChange={(e) => setScope({ ...scope, project_code: e.target.value, department_code: '' })}>
          <option value="">전체</option>
          {/* 저장돼 있던 사업이 목록에 없어도 사라지지 않게 */}
          {scope.project_code && !projects.includes(scope.project_code) && <option value={scope.project_code}>{scope.project_code}</option>}
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <span className="ctx-sep" />
      <div className="ctx-item">
        <label htmlFor="ctx-d">부서</label>
        <select id="ctx-d" style={{ maxWidth: 160 }} value={scope.department_code} onChange={(e) => setScope({ ...scope, department_code: e.target.value })} disabled={!scope.project_code}>
          <option value="">전체</option>
          {deptOpts.map((d) => <option key={d.department_code} value={d.department_code}>{d.department_name}</option>)}
        </select>
      </div>
      <span className="ctx-sep" />
      <div className="ctx-item">
        <label htmlFor="ctx-m">업무월</label>
        <input id="ctx-m" type="month" value={scope.work_month} onChange={(e) => setScope({ ...scope, work_month: e.target.value || thisMonth() })} />
      </div>
    </div>
  )
}

// ⌘K / Ctrl+K 로 여는 메뉴 검색
function Palette({ items, onClose }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const list = items.filter(([, label, code, , , g]) => !q || `${label} ${code} ${g}`.toLowerCase().includes(q.toLowerCase()))
  const go = (it) => { if (it) { nav(it[0]); onClose() } }
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((i + 1) % Math.max(list.length, 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((i - 1 + list.length) % Math.max(list.length, 1)) }
    else if (e.key === 'Enter') go(list[i])
    else if (e.key === 'Escape') onClose()
  }
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="메뉴 검색">
        <div className="palette-input"><Search size={18} /><input autoFocus placeholder="메뉴 이름이나 기능 코드로 이동 (예: 인건비, FN-05)" value={q} onChange={(e) => { setQ(e.target.value); setI(0) }} onKeyDown={key} /></div>
        <div className="palette-list" role="listbox">
          {!list.length && <div className="empty" style={{ padding: 24 }}>일치하는 메뉴가 없습니다.</div>}
          {list.map((it, n) => {
            const [to, label, code, , I, g] = it
            return (
              <div key={to} role="option" aria-selected={n === i} className={`palette-item${n === i ? ' on' : ''}`} onMouseEnter={() => setI(n)} onClick={() => go(it)}>
                <I size={17} /><span>{label}</span><span className="group">{g}</span><small>{code}</small>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Shell({ user, logout, setUser }) {
  const [pw, setPw] = useState(false)
  const [pal, setPal] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar') === 'collapsed')
  const loc = useLocation()
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const [intro, setIntro] = useState(() => !calm && !sessionStorage.getItem('intro'))
  const [tour, setTour] = useState(null)
  // 인트로가 끝난 뒤, 처음 보는 화면이면 투어를 띄운다
  useEffect(() => { if (!intro && !tourSeen(loc.pathname)) setTour(loc.pathname); else setTour(null) }, [loc.pathname, intro])
  const { data: unread } = useApi('/api/notifications/unread-count', { _: loc.pathname })
  const groups = NAV.filter(([, , roles]) => !roles || roles.includes(user.role))
  const items = groups.flatMap(([g, list]) => list.map((it) => [...it, g]))
  const cur = items.find(([to]) => to === loc.pathname) || (loc.pathname === '/notifications' && ['', '알림', '', null, Bell, '내 알림'])

  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((p) => !p) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // 카드 하이라이트가 마우스를 따라가도록 위치를 CSS 변수로 넘긴다
  useEffect(() => {
    const move = (e) => {
      const c = e.target.closest?.('.card')
      if (!c) return
      const r = c.getBoundingClientRect()
      c.style.setProperty('--mx', `${e.clientX - r.left}px`)
      c.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    document.addEventListener('pointermove', move, { passive: true })
    return () => document.removeEventListener('pointermove', move)
  }, [])
  const toggle = () => { localStorage.setItem('sidebar', collapsed ? '' : 'collapsed'); setCollapsed(!collapsed) }
  const mac = /Mac/.test(navigator.platform)

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><Logo /><div className="brand-text">행정 구조대<small>통합 행정 시스템</small></div></div>
        <nav className="nav" aria-label="주 메뉴">
          {groups.map(([g, list]) => (
            <div key={g}>
              <div className="nav-group">{g}</div>
              {list.map(([to, label, code, , I]) => (
                <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined}><I size={18} /><span>{label}</span><small>{code}</small></NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card" title={collapsed ? `${user.name} · ${ROLE[user.role]}` : undefined}>
            <span className="avatar">{user.name?.[0]}</span>
            <div className="user-text"><b>{user.name}</b><small>{ROLE[user.role]}</small></div>
          </div>
          <button className="side-btn" onClick={() => setPw(true)} title="비밀번호 변경"><KeyRound size={17} /><span>비밀번호 변경</span></button>
          <button className="side-btn" onClick={logout} title="로그아웃"><LogOut size={17} /><span>로그아웃</span></button>
          <button className="side-btn" onClick={toggle} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>메뉴 접기</span></button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          {cur && <div className="crumb">{cur[5]}<ChevronRight size={14} /><b>{cur[1]}</b></div>}
          <div className="spacer" />
          <ContextBar />
          <button className="kbd-btn" onClick={() => setPal(true)}><Search size={15} /><span style={{ flex: 1, textAlign: 'left' }}>메뉴 검색</span><kbd>{mac ? <><Command size={11} />K</> : 'Ctrl K'}</kbd></button>
          <button className="icon-btn" onClick={() => setTour(loc.pathname)} aria-label="이 화면 안내 보기" title="이 화면 안내 보기"><CircleHelp size={19} /></button>
          <NavLink to="/notifications" className="icon-btn" aria-label={`알림${unread?.count ? ` ${unread.count}건` : ''}`}>
            <Bell size={19} />{unread?.count > 0 && <span className="dot">{unread.count > 99 ? '99+' : unread.count}</span>}
          </NavLink>
        </header>
        <main className="content" key={loc.pathname}>
          <PageBoundary key={loc.pathname}>
          <Routes>
            {items.map(([to, , , C]) => <Route key={to} path={to} element={<C />} />)}
            <Route path="/notifications" element={<Notifications />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </PageBoundary>
        </main>
      </div>
      {tour && <Tour key={tour} path={tour} onDone={() => setTour(null)} />}
      {intro && <Intro user={user} onDone={() => { sessionStorage.setItem('intro', '1'); setIntro(false) }} />}
      {pal && <Palette items={items} onClose={() => setPal(false)} />}
      {pw && <ChangePassword onDone={() => setUser({ ...user, must_change_password: false })} onClose={() => setPw(false)} />}
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(!!getToken())
  const [toasts, setToasts] = useState([])
  const [scope, setScopeState] = useState(() => ({
    project_code: '', department_code: '', ...JSON.parse(localStorage.getItem('scope') || '{}'), work_month: thisMonth(),
  }))
  const setScope = (s) => { setScopeState(s); localStorage.setItem('scope', JSON.stringify({ project_code: s.project_code, department_code: s.department_code })) }

  const toast = useCallback((msg, type) => {
    const id = Math.random()
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  useEffect(() => {
    if (getToken()) api.get('/api/auth/me').then(setUser, () => setToken(null)).finally(() => setBooting(false))
    const expired = () => { setUser(null); toast('로그인이 만료되었습니다.', 'error') }
    window.addEventListener('auth:expired', expired)
    return () => window.removeEventListener('auth:expired', expired)
  }, [toast])

  const logout = async () => {
    await api.post('/api/auth/logout').catch(() => {})
    setToken(null)
    setUser(null)
  }

  const ctx = useMemo(() => ({ user, scope, setScope, toast }), [user, scope, toast]) // eslint-disable-line react-hooks/exhaustive-deps

  let body
  if (booting) body = <div className="empty" style={{ minHeight: '100vh' }}><Loader2 size={24} className="spin" />불러오는 중…</div>
  else if (!user) body = <Login onLogin={setUser} />
  else if (user.must_change_password) body = <div className="auth" style={{ display: 'block' }}><ChangePassword forced onDone={() => setUser({ ...user, must_change_password: false })} onClose={logout} /></div>
  else body = <BrowserRouter><Shell user={user} logout={logout} setUser={setUser} /></BrowserRouter>

  return (
    <AppCtx.Provider value={ctx}>
      {body}
      <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.type || ''}`} role={t.type === 'error' ? 'alert' : 'status'}>{t.type === 'error' ? <XCircle size={18} /> : <CheckCircle2 size={18} />}{t.msg}</div>)}</div>
    </AppCtx.Provider>
  )
}
