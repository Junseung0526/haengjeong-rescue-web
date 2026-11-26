import { useEffect, useState } from 'react'
import { ScanLine, Upload } from 'lucide-react'
import { api, form } from '../api'
import { Badge, Card, Empty, ErrorBox, PageHead, REASON, Table, useApi, useApp, useDeptNames, deptField, projectField, useModal, label, JOB_STATE } from '../ui'

const FIELD = { name: '성명', date: '날짜', work_kind: '근무 구분' }
const recent = () => JSON.parse(localStorage.getItem('ocr_recent') || '[]')

export default function Ocr() {
  const { scope } = useApp()
  const depts = useDeptNames()
  const [modal, open] = useModal()
  const [files, setFiles] = useState(recent)
  const [sel, setSel] = useState(files[0]?.id || null)
  const [onlyReview, setOnlyReview] = useState(true)
  const [job, setJob] = useState(null)
  const res = useApi(sel ? `/api/ocr/${sel}` : null, { needs_review: onlyReview })

  // 판독 작업이 끝날 때까지 상태 확인
  useEffect(() => {
    if (!job || ['SUCCESS', 'FAILURE'].includes(job.state)) return
    const t = setTimeout(() => api.get(`/api/jobs/${job.task_id}`).then((j) => { setJob(j); if (j.state === 'SUCCESS') res.reload() }), 2000)
    return () => clearTimeout(t)
  }, [job]) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = () => open({
    title: '스캔 출석부 업로드',
    intro: '스캔과 월별 인건비 엑셀을 함께 올리면 일별로 대조합니다.',
    initial: { project_code: scope.project_code, department_code: scope.department_code, work_month: scope.work_month },
    cols: true,
    fields: [
      projectField(depts, { required: true }), deptField(depts, scope.project_code, { required: true }),
      { name: 'work_month', label: '업무월', type: 'month', required: true },
      { name: 'file', label: '스캔 파일', type: 'file', required: true, accept: '.pdf,.jpg,.jpeg,.png,.tif,.tiff', full: true },
      { name: 'reference', label: '인건비 엑셀', type: 'file', required: true, accept: '.xlsx,.xls', full: true },
    ],
    submitLabel: '판독 시작',
    onSubmit: async (v) => {
      const r = await api.post('/api/ocr', form(v))
      const next = [{ id: r.source_file_id, name: v.file.name, month: v.work_month }, ...files].slice(0, 20)
      localStorage.setItem('ocr_recent', JSON.stringify(next))
      setFiles(next)
      setSel(r.source_file_id)
      setJob({ task_id: r.task_id, state: 'PENDING' })
      return '판독을 접수했습니다.'
    },
  })

  const review = (r) => open({
    title: `${FIELD[r.field]} 보정`, initial: { value: r.extracted_val || '' },
    fields: [{ name: 'value', label: '원본 대조 값', required: true }, { name: 'confirm_match', label: '원본과 일치함으로 확정', type: 'checkbox' }, REASON],
    onSubmit: async (v) => { await api.patch(`/api/ocr/${sel}/results/${r.id}`, v); res.reload() },
  })
  const original = () => open({
    title: '원본 보기', intro: '개인정보 열람 권한과 사유가 필요합니다.', fields: [REASON], submitLabel: '내려받기',
    onSubmit: async (v) => { await api.download(`/api/ocr/${sel}/original`, v) },
  })

  return (
    <>
      <PageHead tag="FN-06" title="스캔 출석부 대조" desc="종이 출석부 스캔을 판독해 인건비 엑셀과 비교합니다.">
        <button className="btn primary" onClick={upload}><Upload size={16} />스캔 업로드</button>
      </PageHead>
      {job && <div className={`alert ${job.state === 'FAILURE' ? 'error' : 'info'}`}>
        판독 작업: {label(JOB_STATE, job.state)}{job.progress ? ` (${job.progress.current}/${job.progress.total})` : ''}
        {job.state === 'FAILURE' && <> · <button className="btn sm" onClick={async () => setJob({ ...(await api.post(`/api/ocr/${sel}/retry`)), state: 'PENDING' })}>다시 접수</button></>}
      </div>}
      <div className="filters" style={{ marginBottom: 16 }}>
        <select className="input" value={sel || ''} onChange={(e) => setSel(e.target.value)} aria-label="파일">
          {!files.length && <option value="">최근 업로드 없음</option>}
          {files.map((f) => <option key={f.id} value={f.id}>{f.month} · {f.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={onlyReview} onChange={(e) => setOnlyReview(e.target.checked)} />불일치·미판독만</label>
        {sel && <button className="btn" onClick={original}>원본 보기</button>}
      </div>
      {res.data?.validation_issues?.length > 0 && <div className="alert warn">{res.data.validation_issues.map((i) => i.message).join(' / ')}</div>}
      {res.error?.status !== 404 && <ErrorBox error={res.error} />}
      {!sel && (
        <Card>
          <Empty icon={ScanLine} title="아직 업로드한 스캔이 없습니다." hint="종이 출석부를 스캔해 올리면 판독 결과를 인건비 엑셀과 칸별로 비교해 보여줍니다." />
          <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 32, marginTop: -24 }}>
            <button className="btn primary" onClick={upload}><Upload size={16} />스캔 업로드</button>
          </div>
        </Card>
      )}
      {sel && (
        <Card title={res.data ? `${res.data.filename} ↔ ${res.data.reference_filename}` : '판독 결과'}>
          <Table loading={res.loading} rows={res.data?.results} empty="표시할 판독 결과가 없습니다." emptyHint={job && job.state !== 'SUCCESS' ? '판독이 끝나면 나타납니다.' : null} columns={[
            { key: 'comparison_row', label: '행', num: true },
            { key: 'field', label: '항목', render: (r) => FIELD[r.field] },
            { key: 'extracted_val', label: '판독값', render: (r) => <b>{r.extracted_val || '-'}</b> },
            { key: 'match_status', label: '대조', render: (r) => <Badge v={r.match_status} /> },
            { key: 'a', label: '', render: (r) => r.match_status !== 'matched' && <button className="btn sm" onClick={() => review(r)}>보정</button> },
          ]} />
        </Card>
      )}
      {modal}
    </>
  )
}
