import { useEffect, useRef, useState } from 'react'
import { AGENTS } from '../agents'
import ClosePipeline from './ClosePipeline'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, CircleCheck, Check, FileSearch, Info, Sparkles, Inbox, Landmark, ListTodo, UserCheck, Users } from 'lucide-react'
import { Badge, Bar, Card, Live, useInterval, ErrorBox, PageHead, REASON, RowActions, Seg, Stat, Table, WORK_KIND, date, num, today, useApi, useApp, useModal, won, useUrlState } from '../ui'

// 업무월이 이번 달이면 오늘, 지난 달이면 그 달 말일 기준
export const asOf = (month) => {
  const t = today()
  if (t.startsWith(month)) return t
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).toLocaleDateString('sv-SE')
}

// 새로고침이 끝날 때마다 세 에이전트가 무엇을 다시 확인했는지 한 줄씩 남긴다.
// 이전 값과 달라진 줄은 '확인 필요'로 담당자에게 넘기고, 담당자가 확인하면 누가 언제 봤는지 남긴다.
const LOG_TO = { 0: '/validation', 1: '/changes?field=bank_account&confirmed=false', 2: '/submissions' }
function AgentLog({ snap }) {
  const { user } = useApp()
  const [log, setLog] = useState([])
  const ack = (id) => setLog((l) => l.map((x) => (x.id === id ? { ...x, ack: `${user?.name || '담당자'} ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` } : x)))
  const open = log.filter((x) => x.chg && !x.ack).length
  const prev = useRef(null)
  useEffect(() => {
    const p = prev.current
    const same = p && ['issues', 'blocking', 'subs', 'pending', 'current', 'bank'].every((k) => p[k] === snap[k])
    if (!snap || snap.key === p?.key || (same && Date.now() - p.t < 5000)) return // 같은 결과가 연달아 들어오면 한 번만
    snap.t = Date.now()
    const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const diff = (k) => p && p[k] !== snap[k]
    const add = [
      { a: 0, text: `검증 오류 ${snap.issues}건 재확인 (반영 차단 ${snap.blocking}건)`, chg: diff('issues') || diff('blocking') },
      { a: 2, text: `부서 제출 ${snap.subs}건 상태 확인 · 승인 대기 ${snap.pending}건`, chg: diff('subs') || diff('pending') },
      { a: 1, text: `재직 ${snap.current}명 · 계좌 변경 미확인 ${snap.bank}명 대조`, chg: diff('current') || diff('bank') },
    ].map((x) => ({ ...x, time, id: Math.random() }))
    prev.current = snap
    setLog((l) => [...add, ...l].slice(0, 30))
  }, [snap?.key]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className="card agent-log">
      <div className="card-head">
        <h2>에이전트 활동<span className="count">{log.length}</span>{open > 0 && <span className="need">확인 필요 {open}</span>}</h2>
        <span className="live" style={{ border: 0, padding: 0 }}><span className="live-dot" />감시 중</span>
      </div>
      <ol aria-live="polite">
        {log.map((x, k) => (
          <li key={x.id} className={k < 3 ? 'fresh' : ''} style={{ '--agent': AGENTS[x.a].color, animationDelay: `${(k % 3) * 0.12}s` }}>
            <i /><span><b>{AGENTS[x.a].name.replace(' 에이전트', '')}</b>{x.text}
              {x.chg && (x.ack
                ? <span className="stamp"><Check size={11} />확인 · {x.ack}</span>
                : <span className="log-act"><span className="chg">변동 · 확인 필요</span><Link to={LOG_TO[x.a]}>보기</Link><button type="button" onClick={() => ack(x.id)}>확인</button></span>)}
            </span><time>{x.time}</time>
          </li>
        ))}
        {!log.length && <li style={{ '--agent': '#adb5bd' }}><i /><span className="muted">첫 확인을 준비하고 있습니다…</span><time /></li>}
      </ol>
    </section>
  )
}

const hhmm = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
// 담당자 확인 도장: 같은 문장(같은 수치)일 때만 유지된다. 수치가 바뀌면 다시 확인해야 한다.
const OK_KEY = 'brief-ok'
const okLoad = () => JSON.parse(localStorage.getItem(OK_KEY) || '{}')

// 현황 수치에서 지금 챙길 일을 문장으로 뽑아 한 글자씩 타이핑해 보여준다.
// 규칙 기반 요약이다 (언어 모델 호출 없음). 문장마다 출처·판단 규칙·사용한 수치를 열어 볼 수 있다.
function Briefing({ lines, at, month }) {
  const { user } = useApp()
  const text = lines.map((l) => l.text).join('\n')
  const total = lines.reduce((n, l) => n + l.text.length, 0)
  const [n, setN] = useState(0)
  const [open, setOpen] = useState(null)
  const [ok, setOk] = useState(okLoad)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setN(total)
    setN(0)
    const t = setInterval(() => setN((x) => { if (x >= total) { clearInterval(t); return x } return x + 2 }), 18)
    return () => clearInterval(t)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps
  const confirm = (l) => {
    const next = { ...ok, [`${month}|${l.key}`]: { text: l.text, by: user?.name || '담당자', at: Date.now() } }
    localStorage.setItem(OK_KEY, JSON.stringify(next))
    setOk(next)
  }
  const ICON = { red: [AlertOctagon, 'var(--danger)'], yellow: [AlertTriangle, 'var(--warning)'], green: [CircleCheck, 'var(--success)'], blue: [Info, 'var(--primary)'] }
  const done = n >= total
  const checked = lines.filter((l) => ok[`${month}|${l.key}`]?.text === l.text).length
  let used = 0
  return (
    <section className="card ai-card">
      <div className="card-head">
        <h2><Sparkles size={17} /><span className="ai-title">오늘의 브리핑</span></h2>
        <span className="ai-badge" title="현황 수치를 규칙에 따라 요약했습니다. 언어 모델을 쓰지 않습니다.">자동 요약 · {hhmm(at)} 기준</span>
      </div>
      <div className="card-body ai-lines">
        {lines.map((l, i) => {
          const start = used
          used += l.text.length
          const shown = Math.max(0, Math.min(l.text.length, n - start))
          if (!shown && i) return null
          const [I, c] = ICON[l.tone]
          const typing = shown < l.text.length
          const stamp = ok[`${month}|${l.key}`]
          const valid = stamp?.text === l.text
          const isOpen = open === l.key
          return (
            <div key={l.key} className={`ai-line${valid ? ' checked' : ''}`}>
              <I size={17} color={c} />
              <div className="ai-body">
                <span>{l.text.slice(0, shown)}{typing && <span className="caret" />}{!typing && l.to && <> <Link to={l.to}>{l.cta} →</Link></>}</span>
                {!typing && (
                  <div className="ai-meta">
                    <button type="button" className={`cite${isOpen ? ' on' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : l.key)}>
                      <FileSearch size={12} />{l.src}<span className="sep" />근거 {l.facts.length}
                    </button>
                    {valid
                      ? <span className="stamp" title={`${stamp.by} · ${new Date(stamp.at).toLocaleString('ko-KR')}`}><Check size={12} />확인 · {stamp.by} {hhmm(stamp.at)}</span>
                      : <button type="button" className="ok-btn" onClick={() => confirm(l)}>{stamp ? '수치 바뀜 · 다시 확인' : '확인 표시'}</button>}
                  </div>
                )}
                {isOpen && (
                  <div className="ai-why">
                    <dl>{l.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                    <p><b>판단 규칙</b>{l.why}</p>
                    <p className="muted">출처: {l.src} 화면 · {hhmm(at)}에 불러온 수치</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {done && <div className="ai-foot"><span>담당자 확인 {checked} / {lines.length}</span>자동 요약은 근거 수치로 만든 결과입니다. 처리 전 원천 화면에서 확인하세요.</div>}
    </section>
  )
}

const pct = (m) => (m?.availability === 'available' ? `${Number(m.value).toFixed(1)}` : null)

export default function Dashboard() {
  const { scope } = useApp()
  const [modal, open] = useModal()
  const [state, setState] = useUrlState('state', 'unprocessed')
  const q = { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month }
  const s = useApi('/api/dashboard/summary', { ...q, as_of: asOf(scope.work_month) })
  const subs = useApi('/api/submissions', q)
  const pay = useApi(scope.project_code ? '/api/payroll/summary' : null, q)
  const ins = useApi(scope.project_code ? '/api/insurance/summary' : null, { project_code: scope.project_code, charge_month: scope.work_month })
  const issues = useApi('/api/validation/issues', { ...q, resolved: false })
  const bank = useApi('/api/changes', { ...q, field: 'bank_account', confirmed: false })
  const items = useApi('/api/dashboard/work-items', { ...q, state, limit: 20 })
  const [at, setAt] = useState(Date.now())
  const refresh = () => { s.reload(); subs.reload(); issues.reload(); bank.reload(); items.reload(); pay.reload(); ins.reload() }
  useInterval(refresh, 30000)
  const busy = s.loading || subs.loading || issues.loading || bank.loading
  // 갱신 시각은 요청을 보낸 때가 아니라 응답이 모두 도착한 때
  useEffect(() => { if (!busy) setAt(Date.now()) }, [busy])
  const ready = !busy && s.data?.personnel && Array.isArray(subs.data) && Array.isArray(issues.data)
  const snap = ready && {
    key: `${at}|${scope.project_code}|${scope.department_code}|${scope.work_month}`,
    issues: issues.data.length, blocking: issues.data.filter((i) => i.blocking).length,
    subs: subs.data.length, pending: subs.data.filter((x) => x.latest.status === 'submitted').length,
    current: s.data.personnel.current.value, bank: bank.data?.length ?? 0,
  }

  const d = s.data?.personnel ? s.data : null // 모양이 다른 응답이 와도 화면이 죽지 않게
  const pending = (subs.data || []).filter((x) => x.latest.status === 'submitted').length
  const blocking = (issues.data || []).filter((i) => i.blocking).length
  const cnt = (st) => (subs.data || []).filter((x) => x.latest.status === st).length
  const subParts = [[cnt('approved'), 'green', '승인'], [pending, 'blue', '제출'], [cnt('draft'), 'gray', '임시저장'], [cnt('rejected'), 'red', '반려']]
  const rate = Number(d?.budget.execution_rate?.value) || 0
  const exited = Number(d?.personnel.exited.value) || 0
  const insReview = (Array.isArray(ins.data?.totals) ? ins.data.totals : []).filter((t) => t.reconcile_status === 'needs_review').reduce((n, t) => n + t.count, 0)
  // 문장마다 출처 화면(src), 판단 규칙(why), 사용한 수치(facts)를 붙여 근거를 확인할 수 있게 한다
  const issueN = issues.data?.length ?? 0
  const lines = !d?.budget || !Array.isArray(subs.data) || !Array.isArray(issues.data) ? [] : [
    blocking > 0 && { key: 'blocking', tone: 'red', text: `반영을 막는 검증 오류가 ${blocking}건 남아 있습니다. 해결하기 전에는 인건비를 확정할 수 없습니다.`, to: '/validation', cta: '오류 보기',
      src: '검증 오류', why: '미해결 검증 오류 중 ‘반영 차단’으로 표시된 건이 1건이라도 있으면 알립니다.', facts: [['미해결 오류', `${issueN}건`], ['반영 차단', `${blocking}건`]] },
    bank.data?.length > 0 && { key: 'bank', tone: 'red', text: `계좌 변경을 확인하지 않은 참여자가 ${bank.data.length}명 있습니다. 확인 전까지 급여 지급이 차단됩니다.`, to: '/changes?field=bank_account&confirmed=false', cta: '확인하기',
      src: '전월 대비 변경', why: '전월과 계좌가 달라졌는데 담당자가 아직 확인하지 않은 참여자를 셉니다. 확인 전에는 지급이 막힙니다.', facts: [['계좌 변경 미확인', `${bank.data.length}명`]] },
    pay.data?.recalculation_required_count > 0 && { key: 'recalc', tone: 'red', text: `원천 자료가 바뀌어 다시 계산해야 하는 급여가 ${pay.data.recalculation_required_count}건 있습니다.`, to: '/payroll?tab=people', cta: '재계산하기',
      src: '인건비 계산', why: '계산할 때 저장한 출결·계약·규칙 지문이 지금 원천과 다르면 재계산 대상으로 봅니다.', facts: [['계산 대상', `${num(pay.data.participant_count)}명`], ['재계산 필요', `${pay.data.recalculation_required_count}건`]] },
    insReview > 0 && { key: 'ins', tone: 'yellow', text: `4대보험 고지 중 귀속을 확인해야 하는 건이 ${insReview}건 있습니다.`, to: '/insurance', cta: '확인하기',
      src: '4대보험 귀속', why: '공단 고지 중 사업·참여월을 자동으로 정하지 못해 ‘확인 필요’로 남은 건을 셉니다.', facts: [['확인 필요', `${insReview}건`]] },
    pending > 0 && { key: 'pending', tone: 'yellow', text: `부서에서 올린 제출 ${pending}건이 승인을 기다리고 있습니다.`, to: '/submissions', cta: '검토하기',
      src: '부서 제출', why: '부서별 최신 제출 중 상태가 ‘제출’(승인 전)인 건을 셉니다.', facts: [['전체 제출', `${subs.data.length}건`], ['승인 대기', `${pending}건`]] },
    cnt('rejected') > 0 && { key: 'rejected', tone: 'yellow', text: `반려된 제출이 ${cnt('rejected')}건 있습니다. 부서의 재제출을 확인하세요.`, to: '/deadlines', cta: '독촉하기',
      src: '부서 제출', why: '부서별 최신 제출이 ‘반려’ 상태인 건을 셉니다.', facts: [['반려', `${cnt('rejected')}건`]] },
    exited > 0 && { key: 'exited', tone: 'blue', text: `이달 퇴사자가 ${exited}명입니다. 중도 퇴사 정산 대상인지 확인하세요.`, to: '/settlements', cta: '정산 보기',
      src: '현황 대시보드', why: '업무월 안에 참여가 끝난 사람을 셉니다. 중도 퇴사자는 연차·주휴 정산이 필요할 수 있습니다.', facts: [['이달 참여', `${num(d.personnel.month_participants.value)}명`], ['퇴사', `${exited}명`]] },
    d.budget.availability !== 'unlinked' && pct(d.budget.execution_rate) && { key: 'budget', tone: rate > 90 ? 'yellow' : 'blue', text: `예산 집행률은 ${pct(d.budget.execution_rate)}%이고, 잔액은 ${won(d.budget.remaining_amount.value)}입니다.${rate > 90 ? ' 잔액이 얼마 남지 않았습니다.' : ''}`,
      src: '예산 집행', why: '집행액 ÷ 배정액으로 집행률을 구합니다. 90%를 넘으면 주의로 표시합니다.', facts: [['배정액', won(d.budget.allocated_amount.value)], ['집행액', won(d.budget.executed_amount.value)], ['잔액', won(d.budget.remaining_amount.value)]] },
  ].filter(Boolean)
  if (lines.length && !lines.some((l) => l.tone === 'red' || l.tone === 'yellow')) lines.unshift({ key: 'ok', tone: 'green', text: '급하게 처리할 일이 없습니다. 제출·검증·계산·보험 모두 정상입니다.', src: '현황 대시보드', why: '반영 차단 오류·계좌 변경·재계산·보험 확인·승인 대기·반려가 모두 0건이면 이렇게 알립니다.', facts: [['미해결 오류', `${issueN}건`], ['승인 대기', `${pending}건`]] })

  const complete = (w) => open({
    title: `${WORK_KIND[w.kind]} 처리 확인`,
    intro: '실제 원천과 증빙을 확인한 뒤 처리합니다. 다른 업무에는 전파되지 않습니다.',
    fields: [
      { name: 'status', label: '상태', type: 'select', required: true, options: [['completed', '완료'], ['pending', '처리 대기']] },
      { name: 'evidence', label: '증빙 식별값', hint: '개인정보가 들어가지 않은 값' },
      REASON,
    ],
    initial: { status: 'completed' },
    onSubmit: async (v) => { await api.patch(`/api/dashboard/work-items/${w.id}/status`, { ...v, expected_revision: w.revision, evidence: v.evidence || null }); items.reload() },
  })

  return (
    <>
      <PageHead tag="FN-08" title="현황 대시보드" desc={`${scope.project_code || '전체 사업'} · ${scope.work_month} 기준 (${asOf(scope.work_month)})`}>
        <Live at={at} onRefresh={refresh} busy={busy} />
      </PageHead>
      <ErrorBox error={s.error} />
      <ClosePipeline scope={scope} subs={subs.data} issues={issues.data} pay={pay.data} ins={ins.data} />

      <div className="grid grid-2">
        {lines.length > 0 ? <Briefing lines={lines} at={at} month={scope.work_month} /> : <div className="card"><div className="card-body"><div className="skel" style={{ width: '70%' }} /></div></div>}
        <AgentLog snap={snap} />
      </div>

      <div className="grid grid-4">
        <Stat icon={Users} label="현재 재직" value={num(d?.personnel.current.value)} unit="명" loading={s.loading} hint={d?.personnel.current.definition} to="/participants" />
        <Stat icon={UserCheck} tone="green" label="이달 참여" value={num(d?.personnel.month_participants.value)} unit="명" loading={s.loading} hint={`퇴사 ${num(d?.personnel.exited.value)}명`} />
        <Stat icon={Inbox} tone="yellow" label="승인 대기 제출" value={pending} unit="건" attn={pending > 0} loading={subs.loading} hint={<>제출 포털에서 확인 <ArrowRight size={12} /></>} to="/submissions" />
        <Stat icon={AlertOctagon} tone="gray" label="미해결 검증 오류" value={num(issues.data?.length)} unit="건" attn={blocking > 0} loading={issues.loading} hint={<>반영 차단 {blocking}건 <ArrowRight size={12} /></>} to="/validation" />
      </div>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="부서 제출 진행" count={subs.data?.length} actions={<Link to="/submissions" className="btn sm ghost">전체 보기<ArrowRight size={14} /></Link>} pad>
          <Bar parts={subParts} />
          <div className="legend">{subParts.map(([v, t, l]) => <span key={l}><i className={`bar-${t}`} />{l} <b>{v}</b></span>)}</div>
          {!subs.loading && !subs.data?.length && <p className="muted" style={{ marginTop: 12 }}>이 업무월에 접수된 제출이 없습니다.</p>}
        </Card>
        <Card title="예산 집행" actions={<Landmark size={18} className="muted" />} pad>
          {d?.budget.availability === 'unlinked' ? (
            <p className="muted">{d.budget.allocated_amount.reason}</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
                <b style={{ fontSize: 26, letterSpacing: '-0.02em' }}>{pct(d?.budget.execution_rate) ?? '-'}<small style={{ fontSize: 15 }}>%</small></b>
                <span className="muted">{pct(d?.budget.execution_rate) ? '집행률' : d?.budget.execution_rate.reason}</span>
              </div>
              <Bar parts={[[Math.min(rate, 100), rate > 100 ? 'red' : 'blue'], [Math.max(100 - rate, 0), 'gray']]} />
              <dl className="dl" style={{ marginTop: 16 }}>
                <dt>배정액</dt><dd>{won(d?.budget.allocated_amount.value)}</dd>
                <dt>집행액</dt><dd>{won(d?.budget.executed_amount.value)}</dd>
                <dt>잔액</dt><dd>{won(d?.budget.remaining_amount.value)}</dd>
              </dl>
            </>
          )}
        </Card>
      </div>

      <div className="grid grid-4" style={{ marginTop: 16 }}>
        <Stat icon={ListTodo} label="처리 대기 업무" value={num(d?.workload.registered_pending_task_count)} unit="건" loading={s.loading} />
        <Stat icon={ListTodo} tone="yellow" label="연계 대기 업무" value={num(d?.workload.awaiting_integration_task_count)} unit="건" loading={s.loading} />
        <Stat icon={CheckCircle2} tone="green" label="완료 업무" value={num(d?.workload.completed_task_count)} unit="건" loading={s.loading} />
        <Stat icon={Landmark} tone="gray" label="계좌 변경 미확인" value={num(bank.data?.length ?? 0)} unit="명" attn={bank.data?.length > 0} hint={bank.data?.length ? '확인 전까지 지급 차단' : '모두 확인됨'} to="/changes" />
      </div>

      <Card
        title="업무 목록"
        count={items.data?.items?.length}
        actions={<Seg label="상태" value={state} onChange={setState} options={[['unprocessed', '미처리'], ['pending', '처리 대기'], ['awaiting_integration', '연계 대기'], ['completed', '완료'], ['all', '전체']]} />}
      >
        <Table
          {...items}
          rows={items.data?.items}
          empty="해당하는 업무가 없습니다."
          emptyHint="상태 필터를 바꿔 보세요."
          columns={[
            { key: 'kind', label: '업무', render: (r) => <b>{WORK_KIND[r.kind]}</b> },
            { key: 'department_code', label: '부서' },
            { key: 'agency_code', label: '기관' },
            { key: 'status', label: '상태', render: (r) => <Badge v={r.status} /> },
            { key: 'created_at', label: '등록일', render: (r) => date(r.created_at) },
            { key: 'a', label: '', render: (r) => r.status === 'pending' && <RowActions><button className="btn sm primary" onClick={() => complete(r)}>처리 확인</button></RowActions> },
          ]}
        />
      </Card>

      <Card title="부서별 제출 현황" count={subs.data?.length}>
        <Table
          {...subs}
          rows={subs.data}
          empty="이 업무월에 접수된 제출이 없습니다."
          columns={[
            { key: 'department_code', label: '부서', render: (r) => <b>{r.department_code}</b> },
            { key: 'v', label: '버전', render: (r) => `v${r.latest.version}` },
            { key: 's', label: '상태', render: (r) => <Badge v={r.latest.status} /> },
            { key: 'rows', label: '인원', num: true, render: (r) => num(r.rows) },
            { key: 'open_issues', label: '미해결 오류', num: true, render: (r) => (r.open_issues ? <span style={{ color: 'var(--danger)' }}>{r.open_issues}</span> : 0) },
          ]}
        />
      </Card>
      {modal}
    </>
  )
}
