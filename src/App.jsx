import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BrowserRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Building2, CircleHelp, CalendarCheck, CalendarClock, Calculator, CheckCircle2, ChevronDown, ChevronRight, Command, Eye, EyeOff,
  FileDown, FileSpreadsheet, GitCompare, KeyRound, LayoutDashboard, Loader2, LogOut, PanelLeftClose, PanelLeftOpen, ScanLine,
  ScrollText, Search, Send, ShieldAlert, ShieldCheck, Trash2, TriangleAlert, Users as UsersIcon, UserCog, Wallet, XCircle,
} from 'lucide-react'
import { api, getToken, setToken } from './api'
import { Intro, Tour, tourSeen } from './agents'
import { JinjuScape } from './scape'
import { AppCtx, ErrorBox, Logo, FormModal, ROLE, projName, thisMonth, useApi, useApp, useDeptNames } from './ui'
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

const NARROW = '(max-width: 1279px)'

const STEPS = [
  ['취합', '부서별 엑셀 취합', '부서마다 올린 참여자 명부와 출근부를 하나의 표로 모읍니다.', ['부서 제출 파일 확인', '시트·열 이름 맞추기', '참여자별로 행 합치기']],
  ['검증', '오류 자동 검증', '주민번호·계좌·근무일이 맞지 않는 행을 찾아 담당자에게 알립니다.', ['주민번호 형식 확인', '계좌번호·예금주 대조', '근무일 범위 확인']],
  ['계산', '인건비 계산', '근무일과 단가로 인건비를 계산하고, 금액마다 계산 근거를 남깁니다.', ['근무일 × 일 단가', '주휴·초과근무 반영', '계산 근거 기록']],
  ['귀속', '4대보험 귀속', '사업별 4대보험 부담분을 나눠 예산 항목에 귀속합니다.', ['국민연금·건강보험 산정', '고용·산재보험 산정', '사업별 예산 항목 귀속']],
  ['출력', '지급·제출 양식', '지급 명세와 기관 제출 양식을 바로 내려받을 수 있게 만듭니다.', ['지급 명세서 만들기', '기관 제출 양식 만들기', '담당자 확인 요청']],
]
const STEP_MS = 3600
const CITY_HALL = '52789 경상남도 진주시 동진로 155 (상대동)'


// 남강유등축제처럼 강 위에 유등이 늘 몇 개 떠서 흘러가고, 마우스가 강 위를 지나가면 더 띄운다
const LANTERN_AMBIENT = 12 // 가만히 있을 때 떠 있는 개수
const LANTERN_MAX = 26
function Lanterns() {
  const box = useRef(null)
  const [list, setList] = useState([])
  useEffect(() => {
    const hero = box.current?.parentElement
    if (!hero || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let id = 0
    let last = { t: 0, x: -999 }
    // 물결(viewBox y 192~228) 위 화면 좌표. 그림이 안 보이면(낮은 화면) null
    const water = () => {
      const scape = hero.querySelector('.auth-scape')
      if (!scape || !scape.getClientRects().length) return null
      const s = scape.getBoundingClientRect()
      const h = hero.getBoundingClientRect()
      return { s, h, k: Math.min(s.width / 800, s.height / 230) }
    }
    // x는 hero 기준. delay(초, 음수)를 주면 이미 흘러가던 중인 유등으로 시작한다
    const add = (w, x, { cap = LANTERN_MAX, delay = 0 } = {}) => {
      const t = 9 + Math.random() * 5
      const l = { id: ++id, x, y: w.s.bottom - w.h.top - w.k * (8 + Math.random() * 28), z: 0.75 + Math.random() * 0.45, t, d: delay }
      setList((a) => (a.length >= cap ? (cap === LANTERN_MAX ? [...a.slice(1), l] : a) : [...a, l]))
    }
    const ambient = (delay) => { const w = water(); if (w) add(w, Math.random() * (w.h.width + 200), { cap: LANTERN_AMBIENT, delay }) }
    for (let n = 0; n < LANTERN_AMBIENT * 0.7; n++) ambient(-Math.random() * 8)
    const every = setInterval(() => ambient(0), 950)
    const move = (e) => {
      const w = water()
      if (!w || e.clientY < w.s.bottom - w.k * 80 || e.clientY > w.s.bottom) return
      const now = performance.now()
      if (now - last.t < 140 || Math.abs(e.clientX - last.x) < 22) return
      last = { t: now, x: e.clientX }
      add(w, e.clientX - w.h.left + (Math.random() - 0.5) * 16)
    }
    hero.addEventListener('pointermove', move)
    return () => { hero.removeEventListener('pointermove', move); clearInterval(every); setList([]) }
  }, [])
  return <div ref={box} className="lanterns" aria-hidden="true">{list.map((l) => <span key={l.id} onAnimationEnd={(e) => { if (e.target === e.currentTarget) setList((a) => a.filter((v) => v.id !== l.id)) }} style={{ left: l.x, top: l.y, '--z': l.z, animationDuration: `${l.t}s`, animationDelay: `${l.d}s` }}><i /></span>)}</div>
}

// 로그인 화면 왼쪽: 월 마감 5단계를 차례로 보여 주고, 마우스를 올리거나 누르면 그 단계에 멈춘다
function AuthSteps() {
  const [i, setI] = useState(0)
  const [hold, setHold] = useState(false)
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (hold || still) return
    const t = setTimeout(() => setI((n) => (n + 1) % STEPS.length), STEP_MS)
    return () => clearTimeout(t)
  }, [i, hold, still])
  const [k, title, text, todo] = STEPS[i]
  return (
    <div className={'auth-steps' + (hold || still ? ' hold' : '')} onPointerEnter={() => setHold(true)} onPointerLeave={() => setHold(false)} onFocus={() => setHold(true)} onBlur={() => setHold(false)}>
      <ol>
        {STEPS.map(([k], n) => (
          <li key={k} className={n === i ? 'on' : n < i ? 'done' : ''}>
            <button type="button" aria-pressed={n === i} onClick={() => setI(n)} onPointerEnter={() => setI(n)}>
              <span className="bar" key={n === i ? `${i}-${hold}` : 'x'} aria-hidden="true" />
              <span className="num">{String(n + 1).padStart(2, '0')}</span>
              <span className="lbl">{k}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="auth-agent">
        <span className="dot" aria-hidden="true" />
        <div key={i}>
          <b>{k} 에이전트<span>{title}</span></b><p>{text}</p>
          <ul className="auth-todo">{todo.map((t, n) => <li key={t} style={{ '--d': `${0.35 + n * 0.75}s` }}><CheckCircle2 size={15} />{t}</li>)}</ul>
        </div>
      </div>
    </div>
  )
}

// 모든 화면 맨 아래 저작권·이용 안내
// 자리 비움 화면: 일정 시간 작동이 없거나 상단 버튼을 누르면 개인정보가 보이지 않게 화면을 가린다
const IDLE_MIN = 5
const ACTIVITY = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']

function usePrivacy() {
  const [lock, setLock] = useState(null) // { at, idle }
  useEffect(() => {
    let last = Date.now()
    const on = () => { last = Date.now() }
    ACTIVITY.forEach((e) => window.addEventListener(e, on, { passive: true, capture: true }))
    const t = setInterval(() => { if (Date.now() - last >= IDLE_MIN * 60000) setLock((l) => l || { at: last + IDLE_MIN * 60000, idle: true }) }, 10000)
    return () => { clearInterval(t); ACTIVITY.forEach((e) => window.removeEventListener(e, on, { capture: true })) }
  }, [])
  return [lock, setLock]
}

function Privacy({ user, lock, onBack }) {
  const [now, setNow] = useState(() => new Date())
  const box = useRef(null)
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t) }, [])
  // 뒤 화면(열린 창 포함)은 키보드·스크린리더로도 닿지 않게 한다
  useEffect(() => {
    const others = [...document.body.children].filter((e) => e !== box.current)
    const prev = document.activeElement
    others.forEach((e) => { e.inert = true })
    box.current.querySelector('button').focus()
    return () => { others.forEach((e) => { e.inert = false }); prev?.focus?.() }
  }, [])
  const mins = Math.floor((now - lock.at) / 60000)
  return createPortal(
    <div className="privacy" ref={box} role="dialog" aria-modal="true" aria-labelledby="privacy-title">
      <div className="privacy-col">
        <time className="privacy-clock">{now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</time>
        <p className="privacy-date">{now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}</p>
        <div className="privacy-user"><span className="avatar">{user.name?.[0]}</span><div><b id="privacy-title">{user.name}</b><small>{ROLE[user.role]}</small></div></div>
        <span className="privacy-pill"><EyeOff size={14} />{lock.idle ? `${IDLE_MIN}분 동안 작업이 없어 화면을 가렸습니다` : '자리 비움'} · {mins < 1 ? '방금' : `${mins}분 전부터`}</span>
        <button className="btn primary privacy-back" onClick={onBack}>업무로 돌아가기</button>
        <p className="privacy-hint">개인정보 보호를 위해 내용을 가렸습니다. 돌아가면 보던 화면 그대로 이어집니다.</p>
        <p className="city-tag">진주시 · 행정 구조대</p>
      </div>
    </div>,
    document.body,
  )
}

function Footer() {
  return (
    <footer className="foot">
      <span>© {new Date().getFullYear()} 행정 구조대. All rights reserved.</span>
      <span>진주시 협약 과제 · 내부 업무용 시스템 · 개인정보 무단 열람·유출 금지</span>
    </footer>
  )
}

function Login({ onLogin }) {
  const [v, setV] = useState({ username: '', password: '' })
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
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
      <div className="auth-notice"><ShieldCheck size={14} />진주시 내부 행정업무 시스템 · 인가된 담당자만 이용할 수 있습니다</div>
      <div className="auth-light" aria-hidden="true" />
      <aside className="auth-hero">
        <div className="auth-hero-main">
          <div className="auth-brand"><span className="tile"><img src="/jinju-logo.png" alt="진주시" width="72" height="53" /></span><div><b>행정 구조대</b><small>진주시 통합 행정 시스템</small></div></div>
          <div className="auth-eyebrow">AI 에이전트와 함께하는 진주시 인건비 정산</div>
          <h2>흩어진 행정 자료를<br />한 화면에서 검증하고 마감합니다.</h2>
          <p>참여자 관리부터 인건비 계산, 4대보험 귀속, 제출 양식 출력까지 월 마감 전 과정을 에이전트가 함께 처리합니다.</p>
          <AuthSteps />
        </div>
        <p className="auth-city">진주시청 · {CITY_HALL}</p>
        <JinjuScape />
        <Lanterns />
      </aside>
      <div className="auth-form">
        <form onSubmit={submit}>
          <div className="auth-org">
            <img src="/jinju-logo.png" alt="참진주 진주시" width="72" height="53" />
            <span className="sep" aria-hidden="true" />
            <img className="slogan-img" src="/jinju-slogan.png" alt="부강한 진주 행복한 시민" width="218" height="28" />
          </div>
          <h1>행정 구조대 로그인</h1>
          <p>진주시 업무 담당자 전용입니다.<br />발급받은 계정으로 로그인하세요.</p>
          <ErrorBox error={error} />
          <div className="form">
            <label className="field"><span>아이디</span><input className="input" autoFocus autoComplete="username" required value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} /></label>
            <label className="field"><span>비밀번호</span>
              <div className="pw">
                <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" required value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} onKeyDown={(e) => setCaps(e.getModifierState('CapsLock'))} onKeyUp={(e) => setCaps(e.getModifierState('CapsLock'))} onBlur={() => setCaps(false)} aria-describedby={caps ? 'caps' : undefined} />
                <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} onClick={() => setShow(!show)} aria-label={show ? '비밀번호 숨기기' : '비밀번호 보기'}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
              {caps && <small id="caps" className="caps"><TriangleAlert size={13} />Caps Lock이 켜져 있습니다</small>}
            </label>
            <button className="btn primary" style={{ height: 48, marginTop: 8 }} disabled={busy}>{busy && <Loader2 size={16} className="spin" />}{busy ? '로그인 중…' : '로그인'}</button>
          </div>
          <p className="auth-help">계정이 없거나 잠겼다면 시스템 관리자에게 문의하세요.</p>
          <div className="auth-secure"><ShieldAlert size={15} /><p>인가된 진주시 업무 담당자만 사용할 수 있습니다. 모든 접속·열람 기록이 저장되며, 개인정보를 무단으로 열람·유출하면 관계 법령에 따라 처벌받을 수 있습니다.</p></div>
        </form>
        <Footer />
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
  const names = useDeptNames()
  const projects = [...new Set([...(names?.projects?.list || []).map((p) => p.project_code), ...(depts || []).map((d) => d.project_code)])].sort()
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
          {scope.project_code && !projects.includes(scope.project_code) && <option value={scope.project_code}>{projName(names, scope.project_code)}</option>}
          {projects.map((p) => <option key={p} value={p}>{projName(names, p)}</option>)}
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
// 검색어가 없을 때 위에 띄우는 추천 할 일 (마감을 막는 일부터)
const SUGGEST = [
  ['/validation', '반영을 막는 검증 오류 해결', '', null, TriangleAlert, '추천'],
  ['/changes?field=bank_account&confirmed=false', '지급을 막는 계좌 변경 확인', '', null, Wallet, '추천'],
  ['/payroll?tab=people', '재계산이 필요한 급여 보기', '', null, Calculator, '추천'],
  ['/submissions', '승인을 기다리는 부서 제출 검토', '', null, Send, '추천'],
]

function Palette({ items, onClose }) {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const hits = items.filter(([, label, code, , , g]) => !q || `${label} ${code} ${g}`.toLowerCase().includes(q.toLowerCase()))
  const list = q ? hits : [...SUGGEST.filter(([to]) => items.some(([t]) => t === to.split('?')[0])), ...hits]
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
        <div className="palette-input"><Search size={18} /><input autoFocus placeholder="메뉴나 할 일로 이동 (예: 인건비, 계좌 변경, FN-05)" value={q} onChange={(e) => { setQ(e.target.value); setI(0) }} onKeyDown={key} /></div>
        <div className="palette-list" role="listbox">
          {!list.length && <div className="empty" style={{ padding: 24 }}>일치하는 메뉴가 없습니다.</div>}
          {list.map((it, n) => {
            const [to, label, code, , I, g] = it
            return (
              <div key={to + label} role="option" aria-selected={n === i} className={`palette-item${n === i ? ' on' : ''}`} onMouseEnter={() => setI(n)} onClick={() => go(it)}>
                <I size={17} /><span>{label}</span><span className={`group${g === '추천' ? ' tip' : ''}`}>{g}</span><small>{code}</small>
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
  const [lock, setLock] = usePrivacy()
  // 직접 접거나 펼친 선택이 우선, 없으면 1280px 미만 화면에서 자동으로 접는다
  const [pref, setPref] = useState(() => localStorage.getItem('sidebar') || '')
  const [narrow, setNarrow] = useState(() => matchMedia(NARROW).matches)
  useEffect(() => { const m = matchMedia(NARROW); const on = () => setNarrow(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on) }, [])
  const collapsed = pref ? pref === 'collapsed' : narrow
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

  // 메뉴는 묶음 이름만 보이고, 누르면 펼친다. 지금 화면이 속한 묶음은 자동으로 펼친다
  const [opened, setOpened] = useState(() => new Set(JSON.parse(localStorage.getItem('nav-open') || '[]')))
  const saveOpen = (n) => { localStorage.setItem('nav-open', JSON.stringify([...n])); setOpened(n) }
  const curGroup = cur?.[5]
  useEffect(() => { if (curGroup && !opened.has(curGroup)) saveOpen(new Set([...opened, curGroup])) }, [curGroup]) // eslint-disable-line react-hooks/exhaustive-deps
  // 아이콘만 보일 때, 올린(또는 포커스한) 항목 이름을 오른쪽에 바로 띄운다
  const [tip, setTip] = useState(null)
  const onTip = (e) => {
    const el = collapsed && e.target.closest?.('[data-tip]')
    if (!el) return setTip(null)
    const r = el.getBoundingClientRect()
    setTip({ text: el.dataset.tip, sub: el.dataset.tipSub, x: r.right + 12, y: r.top + r.height / 2 })
  }
  const flip = (g) => { const n = new Set(opened); if (n.has(g)) n.delete(g); else n.add(g); saveOpen(n) }

  // 탭 제목에 화면 이름과 안 읽은 알림 수를 보여준다
  const n = unread?.count || 0
  useEffect(() => { document.title = lock ? '자리 비움 · 행정 구조대' : `${n ? `(${n > 99 ? '99+' : n}) ` : ''}${cur ? `${cur[1]} · ` : ''}행정 구조대 · 진주시` }, [cur?.[1], n, !lock]) // eslint-disable-line react-hooks/exhaustive-deps
  // 내용을 내리면 상단 바에 그림자를 깐다
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(scrollY > 4)
    on()
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((p) => !p) }
      // '/'로 표 검색창에 바로 들어간다 (입력 중이면 그대로 둔다)
      else if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.target.closest('input, textarea, select, [contenteditable]')) {
        const s = document.querySelector('.content .table-tools input')
        if (s) { e.preventDefault(); s.focus(); s.select() }
      }
    }
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
  const toggle = () => { const v = collapsed ? 'open' : 'collapsed'; localStorage.setItem('sidebar', v); setPref(v) }
  const mac = /Mac/.test(navigator.platform)

  return (
    <div className={`shell${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar" onMouseOver={onTip} onFocus={onTip} onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)} onScroll={() => setTip(null)}>
        <button type="button" className="brand" onClick={toggle} data-tip="메뉴 펼치기" title={collapsed ? undefined : '메뉴 접기'} aria-expanded={!collapsed}><Logo /><span className="brand-text">행정 구조대<small>진주시 통합 행정 시스템</small></span></button>
        <nav className="nav" aria-label="주 메뉴">
          {groups.map(([g, list]) => {
            const open = collapsed || opened.has(g)
            return (
              <div key={g} className={`nav-sec${open ? ' open' : ''}`}>
                <button type="button" className="nav-group" onClick={() => flip(g)} aria-expanded={open} disabled={collapsed}>
                  <span>{g}</span><ChevronDown size={15} className="nav-chev" />
                </button>
                <div className="nav-items" inert={!open}>
                  <div>
                    {list.map(([to, label, code, , I]) => (
                      <NavLink key={to} to={to} end={to === '/'} data-tip={label} data-tip-sub={code}><I size={18} /><span>{label}</span><small>{code}</small></NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card" data-tip={user.name} data-tip-sub={ROLE[user.role]}>
            <span className="avatar">{user.name?.[0]}</span>
            <div className="user-text"><b>{user.name}</b><small>{ROLE[user.role]}</small></div>
          </div>
          <button className="side-btn" onClick={() => setPw(true)} data-tip="비밀번호 변경"><KeyRound size={17} /><span>비밀번호 변경</span></button>
          <button className="side-btn" onClick={logout} data-tip="로그아웃"><LogOut size={17} /><span>로그아웃</span></button>
          <button className="side-btn" onClick={toggle} data-tip="메뉴 펼치기">{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}<span>메뉴 접기</span></button>
        </div>
      </aside>
      <div className="main">
        <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
          <a className="org-mark" href="https://www.jinju.go.kr" target="_blank" rel="noreferrer" title="진주시청 누리집 (새 창)"><img src="/jinju-logo.png" alt="진주시" width="44" height="32" /></a>
          {cur && <div className="crumb">{cur[5]}<ChevronRight size={14} /><b>{cur[1]}</b></div>}
          <div className="spacer" />
          <ContextBar />
          <button className="kbd-btn" onClick={() => setPal(true)}><Search size={15} /><span style={{ flex: 1, textAlign: 'left' }}>메뉴 검색</span><kbd>{mac ? <><Command size={11} />K</> : 'Ctrl K'}</kbd></button>
          <button className="icon-btn" onClick={() => { setPal(false); setLock({ at: Date.now(), idle: false }) }} aria-label="화면 가리기 (자리 비움)" title="화면 가리기 · 자리 비움"><EyeOff size={19} /></button>
          <button className="icon-btn" onClick={() => setTour(loc.pathname)} aria-label="이 화면 안내 보기" title="이 화면 안내 보기"><CircleHelp size={19} /></button>
          <NavLink to="/notifications" className="icon-btn" aria-label={`알림${unread?.count ? ` ${unread.count}건` : ''}`}>
            <Bell size={19} />{unread?.count > 0 && <span className="dot" key={unread.count}>{unread.count > 99 ? '99+' : unread.count}</span>}
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
        <Footer />
      </div>
      {tour && <Tour key={tour} path={tour} onDone={() => setTour(null)} />}
      {intro && <Intro user={user} onDone={() => { sessionStorage.setItem('intro', '1'); setIntro(false) }} />}
      {collapsed && tip && <div className="nav-tip" style={{ left: tip.x, top: tip.y }} aria-hidden="true">{tip.text}{tip.sub && <small>{tip.sub}</small>}</div>}
      {pal && <Palette items={items} onClose={() => setPal(false)} />}
      {lock && <Privacy user={user} lock={lock} onBack={() => setLock(null)} />}
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
