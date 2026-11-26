import { useState } from 'react'
import { api } from '../api'
import PayrollBreakdown from './PayrollBreakdown'
import { Badge, Card, ErrorBox, Modal, PageHead, REASON, Stat, Table, Tabs, clean, num, useApi, useApp, useDeptNames, deptField, projName, useModal, won, useUrlState, label, RECALC_REASON } from '../ui'

const AMOUNT_COLS = [
  { key: 'base_pay', label: '기본급', num: true, render: (r) => won(r.base_pay) },
  { key: 'weekly_holiday_pay', label: '주휴수당', num: true, render: (r) => won(r.weekly_holiday_pay) },
  { key: 'paid_leave_pay', label: '유급휴가', num: true, render: (r) => won(r.paid_leave_pay) },
  { key: 'allowance_pay', label: '수당', num: true, render: (r) => won(r.allowance_pay) },
  { key: 'gross_pay', label: '총지급', num: true, render: (r) => <b>{won(r.gross_pay)}</b> },
  { key: 'worker_deductions', label: '공제', num: true, render: (r) => won(r.worker_deductions) },
  { key: 'net_pay', label: '실지급', num: true, render: (r) => won(r.net_pay) },
]

export default function Payroll() {
  const [tab, setTab] = useUrlState('tab', 'summary')
  return (
    <>
      <PageHead tag="FN-03" title="인건비 계산" desc="관리자가 등록한 사업·연도별 규칙과 확인된 근태로 서버가 계산합니다." />
      <Tabs value={tab} onChange={setTab} tabs={[['summary', '월별 집계'], ['people', '개인별 계산'], ['rules', '계산 규칙']]} />
      {tab === 'summary' && <Summary />}
      {tab === 'people' && <People />}
      {tab === 'rules' && <Rules />}
    </>
  )
}

function Summary() {
  const { scope } = useApp()
  const s = useApi(scope.project_code ? '/api/payroll/summary' : null, { project_code: scope.project_code, work_month: scope.work_month, department_code: scope.department_code })
  if (!scope.project_code) return <div className="alert info">상단에서 사업을 선택하세요.</div>
  const d = s.data
  return (
    <>
      <ErrorBox error={s.error} />
      <div className="grid grid-4">
        <Stat label="참여 인원" value={num(d?.participant_count)} unit="명" />
        <Stat label="총지급액" value={num(d?.totals.gross_pay)} unit="원" />
        <Stat label="실지급액" value={num(d?.totals.net_pay)} unit="원" />
        <Stat label="재계산 필요" value={num(d?.recalculation_required_count)} unit="건" attn={d?.recalculation_required_count > 0} hint={d?.warning_count ? `경고 ${d.warning_count}건` : null} />
      </div>
      <Card title="지급 상태별">
        <Table rows={d?.payment_statuses} loading={s.loading} columns={[
          { key: 'status', label: '상태', render: (r) => <Badge v={r.status} /> },
          { key: 'participant_count', label: '인원', num: true },
          ...AMOUNT_COLS.slice(4),
        ]} />
      </Card>
      <Card title="부서별">
        <Table rows={d?.departments} loading={s.loading} columns={[{ key: 'department_code', label: '부서' }, { key: 'participant_count', label: '인원', num: true }, ...AMOUNT_COLS]} />
      </Card>
    </>
  )
}

function People() {
  const { scope } = useApp()
  const [sel, setSel] = useState(null)
  const list = useApi('/api/participants', { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month })
  return (
    <Card title="이달 근무 대상자" actions={<span className="muted">행을 눌러 계산 근거를 보고 계산합니다.</span>}>
      <Table {...list} rows={list.data} onRow={setSel} empty="대상자가 없습니다." columns={[
        { key: 'name', label: '성명', render: (r) => <b>{r.name}</b> },
        { key: 'department_code', label: '부서' },
        { key: 'contract_hours', label: '계약시간', num: true },
        { key: 'unit_wage', label: '시급', num: true, render: (r) => won(r.unit_wage) },
        { key: 'status', label: '상태', render: (r) => <Badge v={r.status} /> },
      ]} />
      {sel && <PayrollDetail p={sel} onClose={() => setSel(null)} />}
    </Card>
  )
}

function PayrollDetail({ p, onClose }) {
  const { scope } = useApp()
  const depts = useDeptNames()
  const [modal, open] = useModal()
  const r = useApi(`/api/payroll/${p.participation_id}`, { work_month: scope.work_month })
  const d = r.data
  const snap = d?.rule_snapshot
  const [view, setView] = useState('why')

  const calc = () => open({
    title: `${p.name} ${scope.work_month} 계산`,
    intro: '근태는 전자출석에서 가져옵니다. 부서별 조정값만 입력합니다.',
    cols: true,
    initial: { department_code: p.department_code, weekly_holiday_hours: 0, unused_annual_leave_hours: 0, worker_deductions: 0, employer_contributions: 0, insurance_mode: 'manual', annual_leave_opening_hours: 0, annual_leave_earned_months: '0' },
    fields: [
      deptField(depts, p.project_code || scope.project_code, { required: true }),
      { name: 'insurance_mode', label: '보험료 반영', type: 'select', required: true, options: [['manual', '수기 공제'], ['linked', '확정 보험료 연결']] },
      { name: 'weekly_holiday_hours', label: '주휴 시간', type: 'number', step: '0.5', required: true },
      { name: 'unused_annual_leave_hours', label: '미사용 연차 정산 시간', type: 'number', step: '0.5', required: true },
      { name: 'worker_deductions', label: '근로자 공제액(원)', type: 'number', required: true },
      { name: 'employer_contributions', label: '기관 부담금(원)', type: 'number', required: true },
      { name: 'annual_leave_opening_hours', label: '연차 기초 잔여 시간', type: 'number', step: '0.5' },
      { name: 'annual_leave_earned_months', label: '만근 월 승인', type: 'select', required: true, options: [['0', '0'], ['1', '1']] },
    ],
    submitLabel: '계산',
    onSubmit: async (v) => {
      await api.post(`/api/payroll/${p.participation_id}/calculate`, {
        work_month: scope.work_month,
        insurance_mode: v.insurance_mode,
        annual_leave_opening_hours: v.annual_leave_opening_hours || '0',
        annual_leave_earned_months: Number(v.annual_leave_earned_months),
        department_adjustments: [{
          department_code: v.department_code, weekly_holiday_hours: v.weekly_holiday_hours, unused_annual_leave_hours: v.unused_annual_leave_hours,
          worker_deductions: v.worker_deductions, employer_contributions: v.employer_contributions,
        }],
      })
      r.reload()
      return '계산했습니다.'
    },
  })

  return (
    <Modal wide title={`${p.name} · ${scope.work_month} 급여`} onClose={onClose}
      footer={<button className="btn primary" disabled={d?.payment_locked} onClick={calc}>{d ? '다시 계산' : '계산'}</button>}>
      {r.error?.status === 404 ? <div className="alert info">아직 계산하지 않았습니다.</div> : <ErrorBox error={r.error} />}
      {d && (
        <>
          {d.payment_locked && <div className="alert warn">지급이 잠겨 다시 계산할 수 없습니다.</div>}
          {d.needs_recalculation && <div className="alert warn">원천 자료가 바뀌어 다시 계산해야 합니다: {d.recalculation_reasons.map((c) => label(RECALC_REASON, c)).join(', ')}</div>}
          {snap.warnings?.map((w, i) => <div key={i} className="alert info">{w.message}</div>)}
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <Stat label="총지급" value={num(snap.amounts.gross_pay)} unit="원" />
            <Stat label="공제" value={num(snap.amounts.worker_deductions)} unit="원" />
            <Stat label="실지급" value={num(snap.amounts.net_pay)} unit="원" />
            <Stat label="연차 잔여" value={num(snap.annual_leave.remaining_hours)} unit="시간" />
          </div>
          <Tabs value={view} onChange={setView} tabs={[['why', '계산 근거'], ['dept', '부서별 금액']]} />
          {view === 'why' ? <PayrollBreakdown snap={snap} /> : (
            <div className="card">
              <Table rows={snap.departments} columns={[{ key: 'department_code', label: '부서' }, { key: 'work_hours', label: '근무시간', num: true }, { key: 'absent_days', label: '결근', num: true }, ...AMOUNT_COLS]} />
            </div>
          )}
        </>
      )}
      {modal}
    </Modal>
  )
}

const RULE_FIELDS = [
  { name: 'version', label: '규칙 이름', required: true, placeholder: '2026 기준' },
  { name: 'wage_mode', label: '시급 방식', type: 'select', required: true, options: [['contract', '계약 시급'], ['fixed', '고정 시급']] },
  { name: 'minimum_hourly_wage', label: '최저 시급(원)', type: 'number', required: true },
  { name: 'hourly_wage', label: '고정 시급(원)', type: 'number', hint: '고정 시급 방식일 때' },
  { name: 'rounding', label: '반올림', type: 'select', required: true, options: [['half_up', '반올림'], ['down', '내림'], ['up', '올림']] },
  { name: 'rounding_unit', label: '반올림 단위', type: 'select', required: true, options: [['1', '1원'], ['10', '10원'], ['100', '100원']] },
  { name: 'annual_leave_days_per_month', label: '월 연차 발생일', type: 'number', step: '0.5', required: true },
  { name: 'annual_leave_carryover_limit_hours', label: '연차 이월 한도(시간)', type: 'number' },
  { name: 'weekly_holiday_days_per_week', label: '주휴 상한 일수', type: 'number', step: '0.1' },
  { name: 'weekly_holiday_weekday', label: '주휴 귀속 요일', type: 'select', options: '월화수목금토일'.split('').map((d, i) => [String(i), d]) },
  { name: 'settle_unused_annual_leave', label: '미사용 연차 정산', type: 'checkbox', full: true },
  { name: 'basis', label: '근거', type: 'textarea', required: true, full: true },
]

function Rules() {
  const { scope } = useApp()
  const depts = useDeptNames()
  const [modal, open] = useModal()
  const year = Number(scope.work_month.slice(0, 4))
  const rules = useApi(scope.project_code ? '/api/payroll/rules' : null, { project_code: scope.project_code, year })
  if (!scope.project_code) return <div className="alert info">상단에서 사업을 선택하세요.</div>
  const toBody = (v) => clean({ ...v, rounding_unit: Number(v.rounding_unit), weekly_holiday_weekday: v.weekly_holiday_weekday === undefined ? undefined : Number(v.weekly_holiday_weekday), settle_unused_annual_leave: !!v.settle_unused_annual_leave, hourly_wage: v.hourly_wage || null })

  const create = () => open({
    title: '계산 규칙 등록', cols: true,
    intro: '적용월부터 그해 말까지 사용하며 더 늦은 규칙이 있으면 교체됩니다.',
    initial: { effective_month: scope.work_month, wage_mode: 'contract', rounding: 'down', rounding_unit: '10', annual_leave_days_per_month: 1, weekly_holiday_days_per_week: 1, weekly_holiday_weekday: '6' },
    fields: [{ name: 'effective_month', label: '적용월', type: 'month', required: true }, ...RULE_FIELDS],
    onSubmit: async (v) => { await api.post('/api/payroll/rules', { ...toBody(v), project_code: scope.project_code }); rules.reload() },
  })
  const edit = (r) => open({
    title: `${r.effective_month} 규칙 수정`, cols: true,
    intro: '계산에 사용된 규칙은 수정할 수 없으니 새 적용월의 규칙으로 등록하세요.',
    initial: { ...r, rounding_unit: String(r.rounding_unit), weekly_holiday_weekday: String(r.weekly_holiday_weekday) },
    fields: [...RULE_FIELDS, REASON],
    onSubmit: async (v) => {
      const { id, revision, project_code, effective_month, ...rest } = toBody(v) // eslint-disable-line no-unused-vars
      await api.put(`/api/payroll/rules/${r.id}`, { ...rest, expected_revision: r.revision })
      rules.reload()
    },
  })

  return (
    <Card title={`${projName(depts, scope.project_code)} · ${year}년 규칙`} actions={<button className="btn primary sm" onClick={create}>규칙 등록</button>}>
      <Table {...rules} rows={rules.data} onRow={edit} empty="등록된 규칙이 없습니다." emptyHint="규칙이 없으면 이 연도의 급여를 계산할 수 없습니다." columns={[
        { key: 'effective_month', label: '적용월' }, { key: 'version', label: '이름' },
        { key: 'wage_mode', label: '시급 방식', render: (r) => (r.wage_mode === 'fixed' ? `고정 ${won(r.hourly_wage)}` : '계약 시급') },
        { key: 'minimum_hourly_wage', label: '최저 시급', num: true, render: (r) => won(r.minimum_hourly_wage) },
        { key: 'annual_leave_days_per_month', label: '월 연차', num: true },
        { key: 'revision', label: '개정', num: true },
      ]} />
      {modal}
    </Card>
  )
}
