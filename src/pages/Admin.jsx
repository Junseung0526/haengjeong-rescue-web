import { useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '../api'
import { Badge, Person, Card, PageHead, REASON, ROLE, Stat, Table, dt, num, useApi, useModal, useUrlState, resetDeptNames, useDeptNames, projName } from '../ui'

const ROLE_OPTS = Object.entries(ROLE)
// "P1:D1, P2" ↔ [{project_code, department_code}]
const parseScopes = (s = '') => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => {
  const [project_code, department_code] = x.split(':')
  return { project_code: project_code || null, department_code: department_code || null }
})
// names를 주면 부서를 이름으로 보여준다 (수정 폼은 코드 형식 그대로)
const showScopes = (sc, names) => (sc.length ? sc.map((s) => [s.project_code ? (names ? projName(names, s.project_code) : s.project_code) : '전체', names?.get(s.department_code) ?? s.department_code].filter(Boolean).join(names ? ' · ' : ':')).join(', ') : '전체')
const SCOPE_HINT = '사업:부서 형식, 쉼표로 구분. 예) P01 (사업 전체), P01:D03 (부서). 비우면 전체'

export function Users() {
  const names = useDeptNames()
  const [modal, open] = useModal()
  const users = useApi('/api/users')

  const create = () => open({
    title: '계정 만들기', cols: true,
    intro: '처음 로그인할 때 비밀번호를 바꾸도록 요구됩니다.',
    initial: { role: 'department_staff' },
    fields: [
      { name: 'username', label: '아이디', required: true }, { name: 'name', label: '이름', required: true },
      { name: 'password', label: '초기 비밀번호', type: 'password', required: true, hint: '8자 이상' },
      { name: 'role', label: '역할', type: 'select', required: true, options: ROLE_OPTS },
      { name: 'scopes', label: '담당 범위', full: true, hint: SCOPE_HINT },
      { name: 'pii_access', label: '개인정보 출력 권한 (주민번호 조회·출력)', type: 'checkbox', full: true },
    ],
    onSubmit: async (v) => { await api.post('/api/users', { ...v, pii_access: !!v.pii_access, scopes: parseScopes(v.scopes) }); users.reload() },
  })

  const edit = (u) => open({
    title: `${u.name} (${u.username})`, cols: true,
    initial: { name: u.name, role: u.role, scopes: showScopes(u.scopes).replace('전체', ''), pii_access: u.pii_access, is_active: u.is_active },
    fields: [
      { name: 'name', label: '이름' }, { name: 'role', label: '역할', type: 'select', required: true, options: ROLE_OPTS },
      { name: 'scopes', label: '담당 범위', full: true, hint: SCOPE_HINT },
      { name: 'password', label: '비밀번호 초기화', type: 'password', hint: '입력하면 다음 로그인 때 변경을 요구합니다.' },
      { name: 'pii_access', label: '개인정보 출력 권한', type: 'checkbox' },
      { name: 'is_active', label: '계정 사용', type: 'checkbox' },
      u.locked && { name: 'unlock', label: '잠금 해제', type: 'checkbox', full: true },
      { ...REASON, required: false },
    ],
    onSubmit: async (v) => {
      await api.patch(`/api/users/${u.id}`, {
        name: v.name, role: v.role, scopes: parseScopes(v.scopes), pii_access: !!v.pii_access, is_active: !!v.is_active,
        password: v.password || null, locked: v.unlock ? false : null, reason: v.reason || null,
      })
      users.reload()
    },
  })

  return (
    <>
      <PageHead tag="NFR-09" title="계정·권한" desc="역할과 사업·부서 범위로 볼 수 있는 자료가 정해집니다.">
        <button className="btn primary" onClick={create}><Plus size={16} />계정 만들기</button>
      </PageHead>
      <Card>
        <Table {...users} rows={users.data} onRow={edit} columns={[
          { key: 'name', label: '이름', render: (r) => <Person name={r.name} /> },
          { key: 'username', label: '아이디', render: (r) => <span className="mono">{r.username}</span> },
          { key: 'role', label: '역할', render: (r) => ROLE[r.role] },
          { key: 'scopes', label: '범위', render: (r) => showScopes(r.scopes, names) },
          { key: 'pii', label: '개인정보', render: (r) => (r.pii_access ? <Badge v="needs_review">출력 가능</Badge> : '-') },
          { key: 's', label: '상태', render: (r) => (r.locked ? <Badge v="rejected">잠김</Badge> : r.is_active ? <Badge v="active">사용</Badge> : <Badge v="exited">중지</Badge>) },
        ]} />
      </Card>
      {modal}
    </>
  )
}

export function Departments() {
  const [modal, open] = useModal()
  const list = useApi('/api/departments')
  const set = (d) => open({
    title: d ? '부서 이름 변경' : '부서 등록', initial: d || {},
    fields: [
      { name: 'project_code', label: '사업코드', required: true }, { name: 'department_code', label: '부서코드', required: true },
      { name: 'department_name', label: '부서 이름', required: true }, { ...REASON, required: false },
    ],
    onSubmit: async (v) => { await api.put(`/api/departments/${encodeURIComponent(v.project_code)}/${encodeURIComponent(v.department_code)}`, { name: v.department_name, reason: v.reason || null }); resetDeptNames(); list.reload() },
  })
  return (
    <>
      <PageHead title="부서" desc="사업·부서 코드에 이름을 붙입니다. 상단 선택 목록에 쓰입니다."><button className="btn primary" onClick={() => set(null)}><Plus size={16} />부서 등록</button></PageHead>
      <Card>
        <Table {...list} rows={list.data} onRow={set} empty="등록된 부서가 없습니다." columns={[
          { key: 'project_code', label: '사업' }, { key: 'department_code', label: '부서코드', render: (r) => <span className="mono">{r.department_code}</span> },
          { key: 'department_name', label: '부서 이름', render: (r) => <b>{r.department_name}</b> },
        ]} />
      </Card>
      {modal}
    </>
  )
}

export function AuditLogs() {
  const [f, setF] = useState({ target_type: '', target_id: '' })
  const [offset, setOffset] = useState(0)
  const logs = useApi('/api/audit-logs', { ...f, limit: 50, offset })
  return (
    <>
      <PageHead tag="NFR-10" title="감사 로그" desc="개인정보 조회·출력, 수정, 승인 등 모든 중요 행위가 남습니다." />
      <Card title="기록" actions={<div className="filters">
        <input className="input sm" placeholder="대상 종류" value={f.target_type} onChange={(e) => { setOffset(0); setF({ ...f, target_type: e.target.value }) }} />
        <input className="input sm" placeholder="대상 ID" value={f.target_id} onChange={(e) => { setOffset(0); setF({ ...f, target_id: e.target.value }) }} />
      </div>}>
        <Table {...logs} rows={logs.data} columns={[
          { key: 'created_at', label: '시각', render: (r) => dt(r.created_at) },
          { key: 'action', label: '행위', render: (r) => <span className="mono">{r.action}</span> },
          { key: 'target', label: '대상', render: (r) => <span className="mono">{r.target_type}:{String(r.target_id).slice(0, 8)}</span> },
          { key: 'actor_id', label: '처리자', render: (r) => <span className="mono">{r.actor_id?.slice(0, 8) || 'system'}</span> },
          { key: 'reason', label: '사유' },
          { key: 'chg', label: '변경', render: (r) => r.after && <details><summary className="muted">보기</summary><pre className="mono" style={{ whiteSpace: 'pre-wrap', maxWidth: 420 }}>{JSON.stringify({ before: r.before, after: r.after }, null, 1)}</pre></details> },
        ]} />
        <Pager offset={offset} setOffset={setOffset} count={logs.data?.length} />
      </Card>
    </>
  )
}

export function SystemErrors() {
  const [kind, setKind] = useUrlState('kind')
  const [offset, setOffset] = useState(0)
  const errs = useApi('/api/system-errors', { kind, limit: 50, offset })
  return (
    <>
      <PageHead tag="NFR-18" title="오류 이력" desc="오류 메시지는 개인정보가 섞일 수 있어 종류와 코드 위치만 보입니다." />
      <Card title="오류" actions={<select className="input sm" value={kind} onChange={(e) => { setOffset(0); setKind(e.target.value) }} aria-label="종류">
        <option value="">전체</option><option value="server_error">API 오류</option><option value="task_failure">작업 실패</option>
      </select>}>
        <Table {...errs} rows={errs.data} empty="기록된 오류가 없습니다." columns={[
          { key: 'created_at', label: '시각', render: (r) => dt(r.created_at) },
          { key: 'kind', label: '종류', render: (r) => <Badge v={r.kind === 'task_failure' ? 'needs_review' : 'rejected'}>{r.kind === 'task_failure' ? '작업 실패' : 'API 오류'}</Badge> },
          { key: 'source', label: '발생', render: (r) => <span className="mono">{r.source}</span> },
          { key: 'error_type', label: '오류 종류', render: (r) => <span className="mono">{r.error_type}</span> },
          { key: 'location', label: '위치', render: (r) => <span className="mono">{r.location}</span> },
        ]} />
        <Pager offset={offset} setOffset={setOffset} count={errs.data?.length} />
      </Card>
    </>
  )
}

function Pager({ offset, setOffset, count }) {
  return (
    <div className="card-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0, justifyContent: 'flex-end' }}>
      <button className="btn sm" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 50))}>이전</button>
      <button className="btn sm" disabled={count < 50} onClick={() => setOffset(offset + 50)}>다음</button>
    </div>
  )
}

export function Retention() {
  const [modal, open] = useModal()
  const p = useApi('/api/retention/preview')
  const d = p.data
  const purge = () => open({
    title: '지금 파기', danger: true,
    intro: `보유기간이 지난 자료를 되돌릴 수 없게 지웁니다. 대상: 사람 ${d.people}명, 제출 행 ${d.submitted_rows}건, 파일 ${d.files}개.`,
    fields: [REASON], submitLabel: '파기',
    onSubmit: async (v) => { const r = await api.post('/api/retention/purge', v); p.reload(); return `${r.people}명, 파일 ${r.files}개를 파기했습니다.` },
  })
  return (
    <>
      <PageHead tag="NFR-08" title="개인정보 파기" desc={d ? `보유기간 ${d.retention_years}년 · 기준일 ${d.cutoff} 이전 자료. 매월 자동으로 파기됩니다.` : ''}>
        <button className="btn danger" disabled={!d || !(d.people + d.submitted_rows + d.files)} onClick={purge}>지금 파기</button>
      </PageHead>
      <div className="grid grid-4">
        <Stat label="파기 대상 인원" value={num(d?.people)} unit="명" />
        <Stat label="제출 행" value={num(d?.submitted_rows)} unit="건" />
        <Stat label="파일" value={num(d?.files)} unit="개" />
      </div>
      {modal}
    </>
  )
}
