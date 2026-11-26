import { useEffect, useState } from 'react'
import { api, form } from '../api'
import { Check, CheckCircle2, Eye, Loader2, Upload } from 'lucide-react'
import { Alert, Card, Dropzone, ErrorBox, PageHead, REASON, RowActions, Stat, Table, dt, num, useApi, useApp, useDeptNames, projName, useModal } from '../ui'
import { ISSUE_COLS } from './Submissions'

const SCAN_STEPS = ['시트 구조를 읽는 중', '머리글 행을 찾는 중', '참여자 행과 합계 행을 구분하는 중', '금액·주민번호 형식을 검증하는 중', '전월 자료와 대조하는 중']

// 서버가 응답할 때까지 진행 단계를 순서대로 보여준다 (실제 진행률이 아니라 대기 표시).
function Scanning({ commit }) {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI((x) => Math.min(x + 1, SCAN_STEPS.length - 1)), 700); return () => clearInterval(t) }, [])
  return (
    <section className="card scan" style={{ marginTop: 16 }} aria-live="polite">
      <div className="scan-orb" />
      <b>{commit ? '검증한 자료를 반영하고 있습니다' : '엑셀을 분석하고 있습니다'}</b>
      <small key={i} style={{ animation: 'fadeUp .3s' }}>{commit ? '행·검증 결과를 저장하는 중' : `${SCAN_STEPS[i]}…`}</small>
      <div className="scan-bar"><i style={{ width: `${((i + 1) / SCAN_STEPS.length) * 92}%` }} /></div>
    </section>
  )
}

export default function Ingest() {
  const { scope, toast } = useApp()
  const depts = useDeptNames()
  const opts = (depts?.list || []).filter((d) => d.project_code === scope.project_code)
  const [modal, open] = useModal()
  const [v, setV] = useState({})
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const files = useApi('/api/ingest/files', { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month })

  const send = async (kind) => {
    setBusy(true)
    setError(null)
    try {
      const r = await api.post(`/api/ingest/${kind}`, form({ project_code: scope.project_code, department_code: v.department_code || scope.department_code, work_month: scope.work_month, file: v.file }))
      setResult(r)
      if (kind === 'commit') {
        toast(r.duplicate ? '이미 반영된 파일입니다.' : '반영했습니다.')
        files.reload()
      }
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  const cancel = (f) => open({
    title: `${f.filename} 반영 취소`, danger: true,
    intro: '이 파일의 행·검증 오류·원본을 지웁니다. 이후 다시 반영할 수 있습니다.',
    fields: [REASON], submitLabel: '반영 취소',
    onSubmit: async (x) => { await api.post(`/api/ingest/files/${f.source_file_id}/cancel`, x); files.reload() },
  })

  const ready = scope.project_code && (v.department_code || scope.department_code) && v.file
  const step = result?.applied ? 3 : result ? 2 : 1
  const blocking = result?.issues.some((i) => i.blocking)
  const STEPS = ['파일 선택', '미리보기 확인', '반영 완료']
  return (
    <>
      <PageHead tag="FN-02" title="엑셀 취합" desc="부서별 산출내역 엑셀을 표준 형식으로 읽어 미리보고, 확인한 뒤 반영합니다." />
      <Card pad>
        <div className="stepper">
          {STEPS.map((t, i) => (
            <div key={t} className={`step${step === i + 1 ? ' on' : ''}${step > i + 1 || (i === 2 && step === 3) ? ' done' : ''}`}>
              <span className="no">{step > i + 1 || (i === 2 && step === 3) ? <Check size={14} /> : i + 1}</span>{t}
            </div>
          ))}
        </div>
        {!scope.project_code && <Alert type="warn">상단에서 사업을 먼저 선택하세요.</Alert>}
        <div className="form cols" style={{ gridTemplateColumns: '220px 1fr', alignItems: 'start' }}>
          <label className="field"><span>부서<em>*</em></span>
            {opts.length
              ? <select className="input" value={v.department_code ?? scope.department_code} onChange={(e) => setV({ ...v, department_code: e.target.value })}>
                  <option value="">선택하세요</option>
                  {opts.map((d) => <option key={d.department_code} value={d.department_code}>{d.department_name}</option>)}
                </select>
              : <input className="input" value={v.department_code ?? scope.department_code} onChange={(e) => setV({ ...v, department_code: e.target.value })} />}
            <small>사업 {scope.project_code ? projName(depts, scope.project_code) : '-'} · 업무월 {scope.work_month}</small></label>
          <div className="field"><span>엑셀 파일<em>*</em></span><Dropzone accept=".xlsx,.xls" value={v.file} onChange={(f) => { setV({ ...v, file: f }); setResult(null) }} /></div>
        </div>
        <div className="actions" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="btn" disabled={!ready || busy} onClick={() => send('preview')}>{busy && step === 1 ? <Loader2 size={15} className="spin" /> : <Eye size={15} />}미리보기</button>
          <button className="btn primary" disabled={!result || result.applied || busy} onClick={() => send('commit')}>{busy && step === 2 ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}확정 반영</button>
        </div>
      </Card>
      <ErrorBox error={error} />
      {busy && <Scanning commit={!!result} />}
      {result && !busy && (
        <>
          {result.applied
            ? <Alert type="success" style={{ marginTop: 16 }}>반영했습니다. 아래 반영된 파일 목록에서 확인하거나 취소할 수 있습니다.</Alert>
            : blocking && <Alert type="warn" style={{ marginTop: 16 }}>반영을 막는 오류가 있습니다. 원본 엑셀을 고친 뒤 다시 미리보기 하세요.</Alert>}
          <div className="grid grid-4" style={{ marginTop: 16 }}>
            <Stat icon={result.applied ? CheckCircle2 : Eye} tone={result.applied ? 'green' : 'blue'} label="읽은 인원" value={num(result.totals.count)} unit="명" hint={result.applied ? '반영됨' : '아직 반영하지 않음'} />
            <Stat label="청구 합계" value={num(result.totals.claim_total)} unit="원" />
            <Stat label="실지급 합계" value={num(result.totals.net_pay)} unit="원" />
            <Stat label="오류" value={result.issues.length} unit="건" attn={blocking} hint={blocking ? '반영 차단 오류 포함' : '차단 오류 없음'} />
          </div>
          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <Card title="시트 읽기 결과" count={result.sheets.length}>
              <Table rows={result.sheets} search={false} columns={[
                { key: 'name', label: '시트', render: (r) => <b>{r.name}</b> }, { key: 'header_row', label: '머리글 행', num: true },
                { key: 'rows', label: '참여자 행', num: true }, { key: 'total_row', label: '합계 행', num: true }, { key: 'skipped_rows', label: '건너뜀', num: true },
              ]} />
            </Card>
            <Card title="오류" count={result.issues.length}><Table rows={result.issues} columns={ISSUE_COLS} empty="오류가 없습니다." emptyIcon={CheckCircle2} /></Card>
          </div>
        </>
      )}
      <Card title="반영된 파일" count={files.data?.length}>
        <Table {...files} rows={files.data} empty="반영된 파일이 없습니다." columns={[
          { key: 'filename', label: '파일', render: (r) => <b>{r.filename}</b> }, { key: 'department_code', label: '부서' },
          { key: 'rows', label: '행', num: true }, { key: 'open_issues', label: '미해결 오류', num: true },
          { key: 'created_at', label: '반영 시각', render: (r) => dt(r.created_at) },
          { key: 'a', label: '', render: (r) => <RowActions><button className="btn sm danger" onClick={() => cancel(r)}>반영 취소</button></RowActions> },
        ]} />
      </Card>
      {modal}
    </>
  )
}
