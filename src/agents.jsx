import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Logo } from './ui'

// 투어·인트로·활동 기록에 쓰는 에이전트 이름과 색
export const AGENTS = [
  { name: '검증 에이전트', color: '#2a6fdb' },
  { name: '정산 에이전트', color: '#1d8a4a' },
  { name: '취합 에이전트', color: '#c8601a' },
]

/* ---------- 페이지 투어 ---------- */
// 각 단계: [선택자, 제목, 설명(문자열 또는 요소를 받아 문자열을 만드는 함수)]. 화면에 없는 요소는 건너뛴다.
const TOURS = {
  '/': [
    ['.close', '월 마감, 한눈에', '제출 → 검증 → 인건비 → 4대보험 → 지급, 마감까지 5단계를 실제 수치로 판정합니다. 초록은 완료, 파랑은 진행 중, 빨강은 막힌 곳이에요. 단계를 누르면 해당 화면으로 갑니다.'],
    ['.close-status', '에이전트가 먼저 점검', '화면을 열 때마다 에이전트 셋이 단계를 차례로 다시 확인합니다. ‘다시 점검’을 누르면 언제든 새로 확인해요.'],
    ['.ai-card', '오늘의 브리핑', '지금 손봐야 할 일을 현황 수치에서 뽑아 문장으로 정리합니다. 문장 끝 링크로 바로 이동하세요.'],
    ['.agent-log', '활동 기록', '30초마다 수치를 다시 불러오고, 바뀐 점만 여기에 남깁니다.'],
    ['.content .grid .stat', '핵심 숫자', '누르면 해당 화면으로 갑니다. 빨간 숫자는 손이 필요한 항목이에요.'],
    ['.ctx', '보는 범위', '사업·부서·업무월을 여기서 바꾸면 모든 화면이 같은 범위로 바뀝니다.'],
    ['.kbd-btn', '빠른 이동', '⌘K (Ctrl+K)를 누르고 화면 이름을 치면 바로 이동합니다.'],
    ['button[aria-label="이 화면 안내 보기"]', '안내 다시 보기', '이 ? 버튼으로 각 화면 설명을 언제든 다시 볼 수 있어요.'],
  ],
  '/ingest': [
    ['.stepper', '세 단계로 반영', '파일 선택 → 미리보기 확인 → 반영 완료 순서로 진행합니다.'],
    ['.drop', '파일 올리기', '부서에서 받은 산출내역 엑셀을 여기로 끌어다 놓으세요.'],
    ['.content .card .actions', '미리보기 먼저', '미리보기로 오류를 확인하고, 문제가 없을 때 확정 반영합니다. 반영한 파일은 아래에서 취소할 수 있어요.'],
  ],
  '/payroll': [
    ['.page-head h1', '인건비 계산', '관리자가 등록한 규칙과 확인된 근태로 서버가 계산합니다. 화면에서 금액을 직접 고치지 않아요.'],
    ['.content .tabs', '세 가지 보기', '월별 집계로 전체를 보고, 개인별 계산에서 한 명씩 계산하며, 계산 규칙에서 기준을 관리합니다.'],
    ['.content .grid .stat', '이달 합계', '대상 인원과 지급·공제 합계입니다. 재계산이 필요한 건이 있으면 빨갛게 표시돼요.'],
    ['.content .card:has(table)', '계산 근거 보기', '개인별 계산에서 행을 누르면 금액이 어떻게 나왔는지 단계별 근거가 열립니다.'],
  ],
  // 인건비 상세 서랍 안의 '계산 근거' (PayrollBreakdown이 직접 띄운다)
  bd: [
    ['.bd-flow', '금액이 쌓이는 순서', '기본급에 유급휴가·주휴·연차·수당을 더해 총지급액이 되고, 근로자 공제를 빼면 실지급액입니다. 막대 길이는 총지급액 중 비중이에요.'],
    ['.bd-check', '화면에서 한 번 더 검산', '시간 × 시급을 규칙의 반올림대로 다시 계산해 서버 금액과 같으면 ‘검산 일치’입니다. ‘규칙 반영’은 최저시급 보정 등 서버 규칙이 더해진 경우예요.'],
    ['.bd-side section', '적용된 규칙', '이 계산에 쓰인 규칙 버전·시급·반올림 방식입니다. 계산할 때의 규칙을 그대로 저장해 두어, 나중에 규칙이 바뀌어도 근거가 남아요.'],
    ['.bd-meta', '바뀌면 알려줌', '출결·계약·규칙의 지문을 함께 저장해, 원천 자료가 바뀌면 다시 계산하라고 알려줍니다.'],
  ],
}
const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
const GENERIC = [
  ['.page-head h1', '이 화면은', (el) => { const p = txt(el.parentElement.querySelector('p')); return `‘${txt(el)}’ 화면입니다.${p ? ` ${p}` : ''}` }],
  ['.page-head .actions .btn.primary', '새 작업 시작', (el) => `새 작업은 ‘${txt(el)}’ 버튼으로 시작합니다.`],
  ['.content .tabs', '보기 바꾸기', '탭을 눌러 보기를 바꿀 수 있어요.'],
  ['.content .card:has(table)', '목록 쓰는 법', (el) => `${txt(el.querySelector('.card-head h2')) ? `‘${txt(el.querySelector('.card-head h2'))}’ 목록입니다. ` : ''}열 제목을 누르면 정렬되고, 행을 누르면 자세한 내용이 열립니다.`],
]

export const tourSeen = (path) => localStorage.getItem(`tour2:${path}`) === '1'

export function Tour({ path, onDone }) {
  const [steps, setSteps] = useState(null)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState(null)
  const [n, setN] = useState(0)

  // 화면이 그려질 시간을 조금 준 뒤 실제로 있는 요소만 단계로 만든다
  useEffect(() => {
    const t = setTimeout(() => {
      const list = (TOURS[path] || GENERIC).map(([sel, title, say]) => {
        const el = document.querySelector(sel)
        return el && { el, title, say: typeof say === 'function' ? say(el) : say }
      }).filter(Boolean)
      if (!list.length) return finish()
      setSteps(list)
    }, path === '/' ? 3000 : 900) // 대시보드는 마감 점검 연출이 끝난 뒤 안내
    return () => clearTimeout(t)
  }, [path]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => { localStorage.setItem(`tour2:${path}`, '1'); onDone() }
  const step = steps?.[i]

  useEffect(() => {
    if (!step) return
    step.el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const measure = () => setRect(step.el.getBoundingClientRect())
    const t = setTimeout(measure, 350)
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    setN(0)
    const typer = setInterval(() => setN((x) => (x >= step.say.length ? x : x + 2)), 16)
    return () => { clearTimeout(t); clearInterval(typer); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step])

  const next = () => (i + 1 < steps.length ? setI(i + 1) : finish())
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') finish()
      else if ((e.key === 'Enter' || e.key === 'ArrowRight') && steps) next()
      else if (e.key === 'ArrowLeft' && i > 0) setI(i - 1)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  if (!step || !rect) return null
  const ag = AGENTS[i % AGENTS.length]
  const pad = 8
  const W = Math.min(340, innerWidth - 32)
  const below = rect.bottom + 240 < innerHeight
  const left = Math.max(16, Math.min(rect.left, innerWidth - W - 16))
  const top = below ? rect.bottom + pad + 14 : Math.max(16, rect.top - pad - 14 - 220)
  const cx = Math.min(rect.right - 12, innerWidth - 30)
  const cy = below ? rect.bottom - 6 : rect.top + 4
  // 서랍(transform 애니메이션) 안에서 띄워도 화면 전체를 덮도록 body로 보낸다
  return createPortal(
    <div className="tour" role="dialog" aria-label="화면 안내">
      <div className="tour-block" onClick={next} />
      <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, '--agent': ag.color }} />
      <div className="agent tour-cursor" style={{ transform: `translate(${cx}px, ${cy}px)`, '--agent': ag.color }}>
        <span key={i} className="agent-ripple" />
        <svg width="22" height="24" viewBox="0 0 20 22"><path d="M2 1.5 18 9.6l-7 1.9-3.2 6.9z" fill="var(--agent)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
      </div>
      <div className="tour-card" style={{ left, top, width: W, '--agent': ag.color }} key={i}>
        <div className="tour-who"><i />{ag.name}<span>{i + 1} / {steps.length}</span></div>
        <h3 className="tour-title">{step.title}</h3>
        <p>{step.say.slice(0, n)}{n < step.say.length && <span className="caret" />}</p>
        <div className="tour-foot">
          <button className="btn ghost sm" onClick={finish}>건너뛰기</button>
          <div className="tour-dots">{steps.map((_, k) => <i key={k} className={k === i ? 'on' : ''} />)}</div>
          {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>이전</button>}
          <button className="btn sm primary" onClick={next} autoFocus>{i + 1 < steps.length ? '다음' : '시작하기'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ---------- 로그인 직후 인트로 ---------- */
export function Intro({ user, onDone }) {
  const [out, setOut] = useState(false)
  const [ready, setReady] = useState(0) // 준비 완료된 에이전트 수
  useEffect(() => {
    const a = setTimeout(() => setOut(true), 3000)
    const b = setTimeout(onDone, 3600)
    // '연결 중'과 '준비 완료'를 CSS 두 애니메이션으로 바꾸면 타이밍이 어긋날 때 겹쳐 보여서, 한 번에 하나만 그린다
    const r = AGENTS.map((_, k) => setTimeout(() => setReady(k + 1), (1.6 + k * 0.35) * 1000))
    return () => { clearTimeout(a); clearTimeout(b); r.forEach(clearTimeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const skip = () => { setOut(true); setTimeout(onDone, 550) }
  const title = '행정 구조대'
  return (
    <div className={`intro${out ? ' out' : ''}`} onClick={skip} role="status" aria-label="시스템 준비 중">
      <div className="intro-center">
        <div className="intro-ring"><Logo className="intro-mark" /></div>
        <p className="city-tag">진주시</p>
        <h1 className="intro-title">{[...title].map((c, k) => <span key={k} style={{ animationDelay: `${0.35 + k * 0.06}s` }}>{c === ' ' ? ' ' : c}</span>)}</h1>
        <p className="intro-hello">{user.name}님, 오늘 업무를 함께할 에이전트를 준비했어요</p>
        <div className="intro-agents">
          {AGENTS.map((a, k) => (
            <div key={a.name} className="intro-agent" style={{ '--agent': a.color, animationDelay: `${1 + k * 0.35}s` }}>
              <i />{a.name}
              {ready > k ? <span className="intro-ok">준비 완료 ✓</span> : <span className="intro-wait">연결 중…</span>}
            </div>
          ))}
        </div>
        <small className="intro-skip">클릭하면 건너뜁니다</small>
      </div>
    </div>
  )
}
