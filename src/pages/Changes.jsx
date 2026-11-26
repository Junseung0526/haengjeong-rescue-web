import { api } from '../api'
import { Badge, Person, Card, PageHead, REASON, Table, date, useApi, useApp, useModal, useUrlState } from '../ui'

const FIELD = { bank_account: '계좌', contract_hours: '계약시간', unit_wage: '시급', department: '부서', period: '참여 기간' }

export default function Changes() {
  const { scope } = useApp()
  const [modal, open] = useModal()
  const [field, setField] = useUrlState('field')
  const [confirmed, setConfirmed] = useUrlState('confirmed', 'false')
  const list = useApi('/api/changes', { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month, field, confirmed })

  const confirm = (c) => open({
    title: `${c.name} ${FIELD[c.field]} 변경 확인`,
    intro: c.field === 'bank_account' ? '계좌 변경은 확인해야 지급 확정 차단이 풀립니다. 본인 확인 여부를 사유에 남기세요.' : `${c.before ?? '-'} → ${c.after ?? '-'}`,
    fields: [REASON], submitLabel: '확인',
    onSubmit: async (v) => { await api.post(`/api/changes/${c.id}/confirm`, v); list.reload() },
  })

  return (
    <>
      <PageHead tag="FN-11" title="전월 대비 변경" desc="전월 확정 자료와 달라진 항목입니다. 계좌 변경은 확인 전까지 지급이 막힙니다." />
      <Card title={`변경 ${list.data?.length ?? ''}건`} actions={<div className="filters">
        <select className="input sm" value={field} onChange={(e) => setField(e.target.value)} aria-label="항목">
          <option value="">모든 항목</option>{Object.entries(FIELD).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="input sm" value={confirmed} onChange={(e) => setConfirmed(e.target.value)} aria-label="확인 여부">
          <option value="false">미확인</option><option value="true">확인됨</option><option value="">전체</option>
        </select>
      </div>}>
        <Table {...list} rows={list.data} empty="변경된 항목이 없습니다." columns={[
          { key: 'name', label: '성명', render: (r) => <Person name={r.name} /> },
          { key: 'department_code', label: '부서' },
          { key: 'field', label: '항목', render: (r) => FIELD[r.field] },
          { key: 'before', label: '전월', render: (r) => <span className="muted">{r.before ?? '-'}</span> },
          { key: 'after', label: '이번 달', render: (r) => <b>{r.after ?? '-'}</b> },
          { key: 's', label: '상태', render: (r) => (r.confirmed ? <Badge v="confirmed" /> : r.payment_locked ? <Badge v="payment_blocked" /> : <Badge v="needs_review" />) },
          { key: 'created_at', label: '감지일', render: (r) => date(r.created_at) },
          { key: 'a', label: '', render: (r) => !r.confirmed && <button className="btn sm primary" onClick={() => confirm(r)}>확인</button> },
        ]} />
      </Card>
      {modal}
    </>
  )
}
