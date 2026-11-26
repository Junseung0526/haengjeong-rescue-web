import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Check, CircleAlert, FileCheck2, Lock, RotateCcw, Send, ShieldCheck, Wallet } from 'lucide-react'
import { AGENTS } from '../agents'
import { num } from '../ui'

// 단계별로 점검을 맡는 에이전트 (취합·검증·정산)
const WHO = { submit: AGENTS[2], validate: AGENTS[0], payroll: AGENTS[1], insurance: AGENTS[1], pay: AGENTS[1] }
const STEP_MS = 520
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const hhmm = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

// 월 마감 진행: 제출 → 검증 → 인건비 → 4대보험 → 지급.
// 각 단계는 이미 불러온 현황 API 값으로 판정한다. 앞 단계가 끝나지 않으면 다음 단계는 '대기'.
// state: done | active | blocked | todo
function judge({ subs, issues, pay, ins }) {
  const approved = subs.filter((s) => s.latest.status === 'approved').length
  const blocking = issues.filter((i) => i.blocking).length
  const st = (k) => pay?.payment_statuses?.find((x) => x.status === k)?.participant_count || 0
  const total = pay?.participant_count || 0
  const calculated = (pay?.payment_statuses || []).reduce((n, x) => n + (x.participant_count || 0), 0)
  const insRows = ins?.totals || []
  const insCount = (k) => insRows.filter((t) => t.reconcile_status === k).reduce((n, t) => n + t.count, 0)
  const insAll = insRows.reduce((n, t) => n + t.count, 0)
  const insOpen = insCount('needs_review') + insCount('awaiting_integration')

  return [
    {
      key: 'submit', label: '부서 제출', icon: Send, to: '/submissions',
      state: !subs.length ? 'todo' : approved === subs.length ? 'done' : subs.some((s) => s.latest.status === 'rejected') ? 'blocked' : 'active',
      metric: subs.length ? `${approved} / ${subs.length} 부서 승인` : '접수된 제출 없음',
      ratio: subs.length ? approved / subs.length : 0,
      why: subs.some((s) => s.latest.status === 'rejected') ? '반려된 제출이 있습니다' : null,
    },
    {
      key: 'validate', label: '취합·검증', icon: FileCheck2, to: '/validation',
      state: !subs.length ? 'todo' : blocking ? 'blocked' : issues.length ? 'active' : 'done',
      metric: !subs.length ? '제출 후 시작' : issues.length ? `미해결 ${issues.length}건 · 차단 ${blocking}건` : '오류 없음',
      ratio: !subs.length ? 0 : issues.length ? Math.max(0.1, 1 - blocking / issues.length) : 1,
      why: blocking ? '반영 차단 오류를 먼저 해결해야 합니다' : null,
    },
    {
      key: 'payroll', label: '인건비 계산', icon: Calculator, to: '/payroll',
      state: !pay ? 'todo' : pay.recalculation_required_count ? 'blocked' : total && calculated >= total ? 'done' : calculated ? 'active' : 'todo',
      metric: !pay ? '사업 선택 필요' : `계산 ${num(calculated)} / ${num(total)}명${pay.recalculation_required_count ? ` · 재계산 ${pay.recalculation_required_count}건` : ''}`,
      ratio: total ? Math.min(1, calculated / total) : 0,
      why: pay?.recalculation_required_count ? '원천 자료가 바뀐 계산이 있습니다' : pay?.warning_count ? `계산 경고 ${pay.warning_count}건` : null,
    },
    {
      key: 'insurance', label: '4대보험 귀속', icon: ShieldCheck, to: '/insurance',
      state: !ins || !insAll ? 'todo' : insCount('needs_review') ? 'blocked' : insOpen ? 'active' : 'done',
      metric: !ins ? '사업 선택 필요' : insAll ? `확정 ${num(insCount('confirmed'))} / ${num(insAll)}건` : '고지 자료 없음',
      ratio: insAll ? insCount('confirmed') / insAll : 0,
      why: insCount('needs_review') ? `확인 필요 ${insCount('needs_review')}건` : null,
    },
    {
      key: 'pay', label: '지급', icon: Wallet, to: '/payroll',
      state: !total ? 'todo' : st('paid') >= total ? 'done' : st('payment_blocked') ? 'blocked' : st('paid') ? 'active' : 'todo',
      metric: total ? `지급 완료 ${num(st('paid'))} / ${num(total)}명` : '계산 후 시작',
      ratio: total ? st('paid') / total : 0,
      why: st('payment_blocked') ? `지급 차단 ${st('payment_blocked')}명 (계좌 변경 확인 필요)` : null,
    },
  ]
}

const STATE = { done: ['완료', 'green'], active: ['진행 중', 'blue'], blocked: ['막힘', 'red'], todo: ['대기', 'gray'] }

// pay: /api/payroll/summary, ins: /api/insurance/summary 응답 (사업 미선택이면 null)
export default function ClosePipeline({ scope, subs, issues, pay, ins }) {
  const has = !!scope.project_code
  const steps = judge({ subs: subs || [], issues: issues || [], pay: pay?.participant_count !== undefined ? pay : null, ins: Array.isArray(ins?.totals) ? ins : null })
  // 앞 단계가 끝나지 않았으면 뒤 단계는 잠근다 (막힘·완료는 그대로 보여준다)
  let open = true
  for (const s of steps) {
    s.locked = !open && s.state !== 'blocked' && s.state !== 'done'
    if (s.state !== 'done') open = false
  }
  const done = steps.filter((s) => s.state === 'done').length
  const blocked = steps.find((s) => s.state === 'blocked')
  const next = blocked || steps.find((s) => s.state !== 'done')

  // 점검 연출: 에이전트가 한 단계씩 확인하며 결과를 드러낸다. at = 지금 확인 중인 단계 (steps.length면 끝)
  const [run, setRun] = useState(0)
  const [at, setAt] = useState(() => (calm() ? steps.length : 0))
  const [doneAt, setDoneAt] = useState(hhmm)
  useEffect(() => {
    if (calm()) return
    setAt(0)
    const t = setInterval(() => setAt((x) => {
      if (x + 1 >= steps.length) { clearInterval(t); setDoneAt(hhmm()) }
      return x + 1
    }), STEP_MS)
    return () => clearInterval(t)
  }, [run, steps.length])
  const scanning = at < steps.length
  const shown = steps.slice(0, at).filter((s) => s.state === 'done').length

  return (
    <section className={`card close${scanning ? ' scanning' : ''}`}>
      <div className="close-head">
        <div className="close-title">
          <div className="close-status" aria-live="polite">
            {scanning
              ? <span style={{ '--agent': WHO[steps[at].key].color }}><i className="pulse" />{WHO[steps[at].key].name}가 <b>{steps[at].label}</b> 확인 중…</span>
              : <span className="ok"><Check size={13} />에이전트 점검 완료 · {doneAt}
                <button type="button" onClick={() => setRun((r) => r + 1)} title="다시 점검"><RotateCcw size={12} />다시 점검</button></span>}
          </div>
          <h2>{scope.work_month} 월 마감 진행</h2>
          <p>
            {scanning ? '제출부터 지급까지 5단계를 실제 수치로 판정하고 있습니다.'
              : !has ? '상단에서 사업을 선택하면 인건비·보험 단계까지 판정합니다.'
                : done === steps.length ? '모든 단계를 마쳤습니다. 제출 양식을 출력해 마감하세요.'
                  : blocked ? <>지금 막힌 곳: <b className="bad">{blocked.label}</b> · {blocked.why}</>
                    : <>다음 할 일: <b>{next.label}</b> · {next.metric}</>}
          </p>
        </div>
        <div className="close-score" aria-label={`5단계 중 ${done}단계 완료`}>
          <b>{shown}<small>/ {steps.length} 단계 완료</small></b>
          <div className="seg5">{steps.map((s, i) => <i key={s.key} className={i < at && !s.locked ? s.state : ''} />)}</div>
        </div>
      </div>
      <ol className="close-steps" key={run}>
        {steps.map((s, i) => {
          const I = i >= at ? s.icon : s.state === 'done' ? Check : s.state === 'blocked' ? CircleAlert : s.locked ? Lock : s.icon
          const [lab, tone] = i >= at ? ['', ''] : s.locked ? ['앞 단계 대기', 'gray'] : STATE[s.state]
          return (
            <li key={s.key} className={`close-step ${i >= at ? 'pending' : s.locked ? 'locked' : s.state}${i === at ? ' now' : ''}`} style={{ '--agent': WHO[s.key].color }}>
              <Link to={s.to} className="close-node">
                <span className="close-no"><I size={17} /></span>
                <span className="close-text">
                  <span className="close-label">{i + 1}. {s.label}{i < at && <span className={`badge ${tone}`}>{lab}</span>}</span>
                  <span className="close-metric">{s.metric}</span>
                  <span className="close-bar"><i style={{ width: `${Math.round(s.ratio * 100)}%` }} /></span>
                  {s.why && !s.locked && i < at && <span className="close-why">{s.why}</span>}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
