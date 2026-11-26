import { useState } from 'react'
import { Pencil, UserPlus } from 'lucide-react'
import { api } from '../api'
import { Badge, Person, Card, ErrorBox, Modal, PageHead, REASON, Table, clean, date, num, useApi, useApp, useDeptNames, deptField, projectField, useModal, won, useUrlState } from '../ui'

export default function Participants() {
  const { scope } = useApp()
  const depts = useDeptNames()
  const [modal, open] = useModal()
  const [status, setStatus] = useUrlState('status')
  const [person, setPerson] = useState(null)
  const list = useApi('/api/participants', { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month, status })

  const register = () => open({
    title: '참여자 등록',
    cols: true,
    intro: '같은 주민번호가 이미 있으면 그 사람의 재참여로 기록됩니다.',
    initial: { project_code: scope.project_code, department_code: scope.department_code, contract_hours: 8 },
    fields: [
      { name: 'name', label: '성명', required: true },
      { name: 'resident_num', label: '주민등록번호', required: true, placeholder: '000000-0000000' },
      projectField(depts, { required: true }),
      deptField(depts, scope.project_code, { required: true }),
      { name: 'start_date', label: '참여 시작일', type: 'date', required: true },
      { name: 'end_date', label: '참여 종료일', type: 'date' },
      { name: 'contract_hours', label: '1일 계약시간', type: 'number', required: true, hint: '1~8시간' },
      { name: 'unit_wage', label: '시급(원)', type: 'number', required: true },
      { name: 'bank_account', label: '계좌', full: true },
      { name: 'mobile', label: '휴대전화' },
      { name: 'first_hire_date', label: '최초 채용일', type: 'date' },
    ],
    submitLabel: '등록',
    onSubmit: async (v) => { await api.post('/api/participants', clean(v)); list.reload(); return '참여자를 등록했습니다.' },
  })

  const transfer = (r) => open({
    title: `${r.name} 부서 이동`,
    intro: '적용일부터 새 부서로 배치되고, 이전 배치는 전날로 끝납니다.',
    fields: [
      deptField(depts, r.project_code, { label: '새 부서', required: true }),
      { name: 'effective_date', label: '적용일', type: 'date', required: true },
      { ...REASON, required: false },
    ],
    onSubmit: async (v) => { await api.post(`/api/participants/${r.participation_id}/transfer`, clean(v)); list.reload() },
  })

  const exit = (r) => open({
    title: `${r.name} 퇴사 처리`,
    danger: true,
    fields: [{ name: 'end_date', label: '마지막 근무일', type: 'date', required: true }, { ...REASON, hint: '최대 200자' }],
    submitLabel: '퇴사 처리',
    onSubmit: async (v) => { await api.post(`/api/participants/${r.participation_id}/exit`, v); list.reload() },
  })

  return (
    <>
      <PageHead tag="FN-01" title="참여자 관리" desc="업무월에 근무하는 참여자와 부서 배치. 행을 누르면 개인 이력을 봅니다.">
        <button className="btn primary" onClick={register}><UserPlus size={16} />참여자 등록</button>
      </PageHead>
      <Card
        title={`참여자 ${list.data ? num(list.data.length) + '명' : ''}`}
        actions={
          <select className="input sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="상태">
            <option value="">전체 상태</option><option value="active">재직</option><option value="waiting">대기</option><option value="exited">퇴사</option>
          </select>
        }
      >
        <Table
          {...list}
          rows={list.data}
          onRow={(r) => setPerson(r.person_id)}
          empty="참여자가 없습니다."
          emptyHint="상단에서 사업·업무월을 확인하거나 참여자를 등록하세요."
          columns={[
            { key: 'name', label: '성명', render: (r) => <Person name={r.name} /> },
            { key: 'resident_num_masked', label: '주민번호', render: (r) => <span className="mono">{r.resident_num_masked}</span> },
            { key: 'department_code', label: '부서' },
            { key: 'p', label: '참여 기간', render: (r) => `${date(r.start_date)} ~ ${r.end_date ? date(r.end_date) : ''}` },
            { key: 'contract_hours', label: '계약시간', num: true, render: (r) => (r.contract_hours == null ? "-" : `${r.contract_hours}h`) },
            { key: 'unit_wage', label: '시급', num: true, render: (r) => won(r.unit_wage) },
            { key: 'status', label: '상태', render: (r) => <Badge v={r.status} /> },
            {
              key: 'a', label: '', render: (r) => r.status !== 'exited' && (
                <div className="actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn sm" onClick={() => transfer(r)}>부서 이동</button>
                  <button className="btn sm danger" onClick={() => exit(r)}>퇴사</button>
                </div>
              ),
            },
          ]}
        />
      </Card>
      {person && <PersonDrawer id={person} onClose={() => setPerson(null)} onChanged={list.reload} />}
      {modal}
    </>
  )
}

function PersonDrawer({ id, onClose, onChanged }) {
  const { user } = useApp()
  const [modal, open] = useModal()
  const [rrn, setRrn] = useState(null)
  const p = useApi(`/api/participants/persons/${id}`)
  const d = p.data

  const reveal = () => open({
    title: '주민등록번호 조회',
    intro: '출력 권한자만 조회할 수 있고, 사유가 감사 로그에 남습니다.',
    fields: [REASON],
    submitLabel: '조회',
    onSubmit: async (v) => { setRrn((await api.post(`/api/participants/persons/${id}/resident-number`, v)).resident_num); return '조회했습니다.' },
  })

  const edit = () => open({
    title: '인적 정보 수정',
    intro: '이름·계좌는 모든 사업에 공유됩니다.',
    cols: true,
    initial: { name: d.name, mobile: d.mobile || '', phone: d.phone || '', first_hire_date: d.first_hire_date || '' },
    fields: [
      { name: 'name', label: '성명' },
      { name: 'bank_account', label: '계좌 (바꿀 때만)' },
      { name: 'mobile', label: '휴대전화' },
      { name: 'phone', label: '전화' },
      { name: 'first_hire_date', label: '최초 채용일', type: 'date' },
      REASON,
    ],
    onSubmit: async (v) => { await api.patch(`/api/participants/persons/${id}`, clean(v)); p.reload(); onChanged() },
  })

  return (
    <Modal title={d ? `${d.name} 개인 이력` : '개인 이력'} onClose={onClose} wide
      footer={d && <>
        {user.pii_access && <button className="btn" onClick={reveal}>주민번호 조회</button>}
        <button className="btn primary" onClick={edit}><Pencil size={15} />인적 정보 수정</button>
      </>}>
      <ErrorBox error={p.error} />
      {d && (
        <>
          <dl className="dl" style={{ marginBottom: 20 }}>
            <dt>주민번호</dt><dd className="mono">{rrn || d.resident_num_masked}</dd>
            <dt>계좌 등록</dt><dd>{d.has_bank_account ? '등록됨' : <Badge v="x">미등록</Badge>}</dd>
            <dt>휴대전화</dt><dd>{d.mobile || '-'}</dd>
            <dt>최초 채용일</dt><dd>{date(d.first_hire_date)}</dd>
          </dl>
          <div className="card">
            <Table rows={d.history} columns={[
              { key: 'project_code', label: '사업' },
              { key: 'department_code', label: '부서' },
              { key: 'pl', label: '배치 기간', render: (r) => `${date(r.placement_start)} ~ ${r.placement_end ? date(r.placement_end) : ''}` },
              { key: 'p', label: '참여 기간', render: (r) => `${date(r.start_date)} ~ ${r.end_date ? date(r.end_date) : ''}` },
              { key: 'status', label: '상태', render: (r) => <Badge v={r.status} /> },
              { key: 'exit_reason', label: '퇴사 사유' },
            ]} />
          </div>
        </>
      )}
      {modal}
    </Modal>
  )
}
