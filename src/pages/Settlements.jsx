import { useState } from 'react'
import { api } from '../api'
import { Badge, Person, Card, ErrorBox, Modal, PageHead, Stat, Table, date, num, useApi, useApp } from '../ui'

export default function Settlements() {
  const { scope, toast } = useApp()
  const [view, setView] = useState(null)
  const [error, setError] = useState(null)
  const on = !!scope.project_code
  const list = useApi(on ? '/api/settlements/periods' : null, { project_code: scope.project_code, work_month: scope.work_month, department_code: scope.department_code })

  const calc = async (p, kind) => {
    setError(null)
    try {
      await api.post(`/api/settlements/${p.participation_id}/calculate`, { kind })
      toast('정산했습니다.')
      list.reload()
      setView({ p, kind })
    } catch (e) { setError(e) }
  }

  const btn = (r, kind) => {
    if (!(kind === 'join' ? r.joined : r.exited)) return null
    const st = r.settlements?.[kind]
    return (
      <div className="actions">
        {st && <button className="btn sm" onClick={() => setView({ p: r, kind })}><Badge v={st} /></button>}
        <button className="btn sm primary" onClick={() => calc(r, kind)}>{st ? '다시 정산' : '정산'}</button>
      </div>
    )
  }

  return (
    <>
      <PageHead tag="FN-14" title="중도 입·퇴사 정산" desc="전자출석과 서버 급여 규칙으로 일할 근무급·주휴·미사용 연차를 계산합니다. 퇴사 정산 금액은 EX-02 상실 신고의 퇴사 월 보수가 됩니다." />
      {!on && <div className="alert info">상단에서 사업을 선택하세요.</div>}
      <ErrorBox error={error} />
      {on && (
        <Card title={`${scope.work_month} 입·퇴사자`}>
          <Table {...list} rows={list.data} empty="이 달에 입사하거나 퇴사한 사람이 없습니다." columns={[
            { key: 'name', label: '성명', render: (r) => <Person name={r.name} /> },
            { key: 'department_code', label: '부서' },
            { key: 'p', label: '이달 근무 기간', render: (r) => `${date(r.period_start)} ~ ${date(r.period_end)}` },
            { key: 'rep', label: '대체 관계', render: (r) => (r.replaces ? '대체 투입' : r.replaced_by ? '대체됨' : '-') },
            { key: 'join', label: '입사 정산', render: (r) => btn(r, 'join') || <span className="muted">-</span> },
            { key: 'exit', label: '퇴사 정산', render: (r) => btn(r, 'exit') || <span className="muted">-</span> },
          ]} />
        </Card>
      )}
      {view && <SettlementView {...view} onClose={() => setView(null)} />}
    </>
  )
}

function SettlementView({ p, kind, onClose }) {
  const s = useApi(`/api/settlements/${p.participation_id}`, { kind })
  const d = s.data
  return (
    <Modal wide title={`${p.name} ${kind === 'join' ? '입사' : '퇴사'} 정산`} onClose={onClose}>
      <ErrorBox error={s.error} />
      {d && (
        <>
          {d.stale && <div className="alert warn">정산 뒤 참여 종료일이 바뀌었습니다. 다시 정산해야 EX-02에 쓸 수 있습니다.</div>}
          {d.snapshot.warnings.map((w) => <div key={w.code} className="alert info">{w.message}</div>)}
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <Stat label="근무급" value={num(d.base_pay)} unit="원" hint={`${num(d.snapshot.worked_hours)}시간`} />
            <Stat label="주휴수당" value={num(d.weekly_holiday_pay)} unit="원" hint={`${num(d.snapshot.weekly_holiday_hours)}시간`} />
            <Stat label="미사용 연차" value={num(d.unused_annual_leave_pay)} unit="원" />
            <Stat label="예상 보수액" value={num(d.expected_pay)} unit="원" />
          </div>
          <div className="card">
            <Table rows={d.snapshot.weekly_holidays} empty="주휴 대상 주가 없습니다." columns={[
              { key: 'week_start', label: '주 시작' }, { key: 'attribution_date', label: '귀속일' },
              { key: 'sd', label: '소정근로일', num: true, render: (r) => r.scheduled_days.length },
              { key: 'qualified', label: '만근', render: (r) => (r.qualified ? <Badge v="completed">충족</Badge> : <Badge v="absent">미충족</Badge>) },
              { key: 'hours', label: '주휴 시간', num: true },
            ]} />
          </div>
        </>
      )}
    </Modal>
  )
}
