import { api } from '../api'
import { Card, PageHead, REASON, Table, useApi, useApp, useModal, useUrlState } from '../ui'
import { ISSUE_COLS } from './Submissions'

export default function Validation() {
  const { scope } = useApp()
  const [modal, open] = useModal()
  const [resolved, setResolved] = useUrlState('resolved', 'false')
  const [type, setType] = useUrlState('type')
  const rules = useApi('/api/validation/rules')
  const issues = useApi('/api/validation/issues', {
    project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month, resolved, issue_type: type,
  })

  const confirm = (i) => open({
    title: '값을 두고 확인 처리',
    intro: `${i.person_name || ''} · ${i.title}`,
    fields: [REASON], submitLabel: '확인 처리',
    onSubmit: async (x) => { await api.post(`/api/validation/issues/${i.id}/confirm`, x); issues.reload() },
  })

  const fix = (i) => open({
    title: '항목 수정',
    intro: `${i.person_name || ''} · ${i.field_label || i.field} (현재 ${i.actual_val ?? '빈 값'}${i.expected_val ? `, 기준 ${i.expected_val}` : ''}). 저장하면 관련 검사와 합계를 다시 실행합니다.`,
    initial: { value: i.expected_val ?? i.actual_val ?? '' },
    fields: [{ name: 'value', label: '새 값', hint: '비우면 값을 지웁니다.' }, REASON],
    onSubmit: async (x) => {
      const r = await api.patch(`/api/validation/rows/${i.row_id}`, { [i.field]: x.value === '' ? null : x.value, reason: x.reason })
      issues.reload()
      return `수정했습니다. 남은 오류 ${r.issues.filter((e) => !e.is_resolved).length}건`
    },
  })

  return (
    <>
      <PageHead tag="FN-05" title="검증 오류" desc="포털·엑셀·전자출석·OCR이 같은 규칙을 거칩니다. 차단 오류는 값을 고쳐야 하고, 확인 오류는 사유를 남겨 넘길 수 있습니다." />
      <Card
        title={`오류 ${issues.data?.length ?? ''}건`}
        actions={<div className="filters">
          <select className="input sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="오류 종류">
            <option value="">모든 규칙</option>
            {(rules.data || []).map((r) => <option key={r.code} value={r.code}>{r.title}</option>)}
          </select>
          <select className="input sm" value={resolved} onChange={(e) => setResolved(e.target.value)} aria-label="해결 여부">
            <option value="false">미해결</option><option value="true">해결</option><option value="">전체</option>
          </select>
        </div>}
      >
        <Table {...issues} rows={issues.data} empty="오류가 없습니다." emptyHint="이 업무월 자료가 모든 검사를 통과했습니다."
          columns={[...ISSUE_COLS, { key: 'department_code', label: '부서' }, {
            key: 'a', label: '', render: (r) => !r.is_resolved && (
              <div className="actions">
                {r.row_id && r.field && <button className="btn sm" onClick={() => fix(r)}>수정</button>}
                {!r.blocking && <button className="btn sm" onClick={() => confirm(r)}>확인</button>}
              </div>
            ),
          }]} />
      </Card>
      {modal}
    </>
  )
}
