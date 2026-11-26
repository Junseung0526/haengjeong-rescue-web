import { useState } from 'react'
import { CheckCircle2, CircleHelp, Equal, Info, Minus, Plus } from 'lucide-react'
import { Tour, tourSeen } from '../agents'
import { LABEL, Seg, num, won } from '../ui'

// 급여 계산 근거: 서버가 저장한 rule_snapshot만으로 "어떻게 이 금액이 나왔는지"를 보여준다.
// 시간 × 시급은 화면에서 단순 검산해, 서버 금액과 같으면 '검산 일치'를 표시한다.
const N = (v) => Number(v || 0)
const ROUND = { half_up: Math.round, down: Math.floor, up: Math.ceil }
const roundBy = (rule, v) => {
  const unit = N(rule?.rounding_unit) || 1
  return (ROUND[rule?.rounding] || Math.round)(v / unit) * unit
}
const h = (v) => `${num(N(v))}시간`

function Check({ rule, hours, wage, amount }) {
  if (!N(hours) || !N(wage)) return null
  const ok = roundBy(rule, N(hours) * N(wage)) === N(amount)
  return ok
    ? <span className="bd-check ok" title="시간 × 시급을 규칙대로 반올림한 값과 같습니다"><CheckCircle2 size={13} />검산 일치</span>
    : <span className="bd-check" title="단순 곱과 다릅니다. 최저시급 보정·일할 계산 등 서버 규칙이 반영된 값입니다"><Info size={13} />규칙 반영</span>
}

function Row({ sign, label, formula, amount, check, total, strong }) {
  const S = { '+': Plus, '-': Minus, '=': Equal }[sign]
  const w = total ? Math.min(100, (Math.abs(N(amount)) / total) * 100) : 0
  return (
    <div className={`bd-row${strong ? ' strong' : ''} ${sign === '-' ? 'neg' : ''}`}>
      <span className="bd-sign">{S && <S size={13} />}</span>
      <div className="bd-main">
        <div className="bd-label">{label}{check}</div>
        {formula && <div className="bd-formula">{formula}</div>}
        {!strong && <div className="bd-bar"><i style={{ width: `${w}%` }} /></div>}
      </div>
      <div className="bd-amount">{sign === '-' && N(amount) ? '−' : ''}{won(Math.abs(N(amount)))}</div>
    </div>
  )
}

export default function PayrollBreakdown({ snap }) {
  const depts = snap.departments || []
  const [k, setK] = useState('all')
  const [tour, setTour] = useState(() => !tourSeen('bd'))
  const one = k === 'all' ? null : depts.find((d) => d.department_code === k)
  const a = one || snap.amounts
  const sum = (f) => (one ? N(one[f]) : depts.reduce((n, d) => n + N(d[f]), 0))
  const rule = snap.server_policy
  const wage = snap.unit_wage
  const gross = N(a.gross_pay)
  const ins = (snap.linked_insurance || []).filter((x) => x.reconcile_status === 'confirmed' || !x.reconcile_status)
  const days = (snap.attendance || []).filter((d) => !one || d.department_code === one.department_code)
  const byKind = days.reduce((m, d) => ({ ...m, [d.kind]: (m[d.kind] || 0) + 1 }), {})

  return (
    <div className="bd">
      {tour && <Tour path="bd" onDone={() => setTour(false)} />}
      <div className="bd-top">
        {depts.length > 1 && <Seg label="부서" value={k} onChange={setK} options={[['all', '전체 합계'], ...depts.map((d) => [d.department_code, d.department_code])]} />}
        <button type="button" className="btn ghost sm" onClick={() => setTour(true)}><CircleHelp size={14} />계산 근거 읽는 법</button>
      </div>
      <div className="bd-grid">
        <div className="bd-flow">
          <Row sign="" label="기본급" formula={`근무 ${h(sum('work_hours'))} × 시급 ${won(wage)}`} amount={a.base_pay} total={gross}
            check={<Check rule={rule} hours={sum('work_hours')} wage={wage} amount={a.base_pay} />} />
          {N(a.paid_leave_pay) > 0 && <Row sign="+" label="유급휴가" formula={`유급휴가 ${h(sum('paid_leave_hours'))} × 시급`} amount={a.paid_leave_pay} total={gross}
            check={<Check rule={rule} hours={sum('paid_leave_hours')} wage={wage} amount={a.paid_leave_pay} />} />}
          <Row sign="+" label="주휴수당" formula={`주휴 ${h(sum('weekly_holiday_hours'))} × 시급${rule?.weekly_holiday_days_per_week ? ` · 주당 상한 ${rule.weekly_holiday_days_per_week}일` : ''}`} amount={a.weekly_holiday_pay} total={gross}
            check={<Check rule={rule} hours={sum('weekly_holiday_hours')} wage={wage} amount={a.weekly_holiday_pay} />} />
          {N(a.unused_annual_leave_pay) > 0 && <Row sign="+" label="미사용 연차 정산" formula={`${h(sum('unused_annual_leave_hours'))} × 시급`} amount={a.unused_annual_leave_pay} total={gross}
            check={<Check rule={rule} hours={sum('unused_annual_leave_hours')} wage={wage} amount={a.unused_annual_leave_pay} />} />}
          {N(a.allowance_pay) > 0 && <Row sign="+" label="수당" formula="부서별 수당 합계" amount={a.allowance_pay} total={gross} />}
          <Row sign="=" label="총지급액" amount={a.gross_pay} strong />
          <Row sign="-" label="근로자 공제" total={gross} amount={a.worker_deductions}
            formula={snap.input?.insurance_mode === 'linked'
              ? `확정 보험료 ${ins.length}건 연결 + 기타 공제`
              : '수기 입력 공제 (보험료·세금 등)'} />
          <Row sign="=" label="실지급액" amount={a.net_pay} strong />
          <div className="bd-note">기관 부담금 {won(a.employer_contributions)}은 실지급액과 별도로 기관이 냅니다.</div>
        </div>

        <aside className="bd-side">
          <section>
            <h4>적용 규칙</h4>
            {rule ? (
              <dl className="dl">
                <dt>규칙</dt><dd>{rule.version} <span className="muted">(rev.{rule.revision})</span></dd>
                <dt>시급 방식</dt><dd>{rule.wage_mode === 'fixed' ? `고정 ${won(rule.hourly_wage)}` : '계약 시급'}{snap.contract_unit_wage && rule.wage_mode !== 'fixed' ? ` · 계약 ${won(snap.contract_unit_wage)}` : ''}</dd>
                <dt>최저 시급</dt><dd>{won(rule.minimum_hourly_wage)}</dd>
                <dt>적용 시급</dt><dd><b>{won(wage)}</b></dd>
                <dt>반올림</dt><dd>{{ half_up: '반올림', down: '내림', up: '올림' }[rule.rounding] || rule.rounding} · {rule.rounding_unit}원 단위</dd>
                <dt>연차 발생</dt><dd>월 {rule.annual_leave_days_per_month}일</dd>
              </dl>
            ) : <p className="muted">저장된 규칙 정보가 없습니다.</p>}
            {rule?.basis && <p className="bd-basis">근거: {rule.basis}</p>}
          </section>
          <section>
            <h4>출결 근거 <span className="muted">{days.length}일</span></h4>
            <div className="bd-kinds">
              {Object.entries(byKind).map(([kind, n]) => <span key={kind} className={`badge ${LABEL[kind]?.[1] || ''}`}>{LABEL[kind]?.[0] || kind} {n}</span>)}
              {!days.length && <span className="muted">출결 기록 없음</span>}
            </div>
            {snap.excluded_attendance?.length > 0 && (
              <ul className="bd-list">{snap.excluded_attendance.slice(0, 4).map((x, i) => <li key={i}>{x.work_date} 제외 · {x.reason}</li>)}</ul>
            )}
            {snap.attendance_check_until && <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{snap.attendance_check_until}까지 출결 확인됨</p>}
          </section>
          <section>
            <h4>연차</h4>
            <dl className="dl">
              <dt>기초</dt><dd>{h(snap.annual_leave?.opening_hours)}{snap.carryover_check?.status === 'matched' && <span className="bd-check ok"><CheckCircle2 size={13} />전월 잔여와 일치</span>}</dd>
              <dt>발생 · 사용</dt><dd>+{h(snap.annual_leave?.accrued_hours)} / −{h(snap.annual_leave?.used_hours)}</dd>
              <dt>잔여</dt><dd><b>{h(snap.annual_leave?.remaining_hours)}</b></dd>
            </dl>
          </section>
          <p className="bd-meta">계산 버전 v{snap.calculation_version} · 원천 자료 {Object.keys(snap.source_fingerprints || {}).length}종의 지문을 함께 저장해, 출결·계약·규칙이 바뀌면 재계산이 필요하다고 알려줍니다.</p>
        </aside>
      </div>
    </div>
  )
}
