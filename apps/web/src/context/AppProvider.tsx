import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Clash,
  ClashInferenceResult,
  ClashSeverity,
  ParsedClashResult,
} from '../types'
import { clashMatchesSeverityExactly, normalizeClashSeverity } from '../types'
import {
  deleteClashSession,
  fetchClashSession,
} from '../lib/clashSession'
import { uploadClashReport } from '../lib/uploadClashReport'
import {
  AppContext,
  type ClashObjectViewerFocusRequest,
  type SpeckleUrlRow,
  type UploadProgress,
} from './appStateContext'

function mapBackendClash(raw: ParsedClashResult, testName?: string): Clash {
  const meta = raw.clashMetadata
  const guidRaw = raw.clashGuid ?? undefined
  return {
    id: guidRaw?.trim()
      ? guidRaw.trim().toLowerCase()
      : crypto.randomUUID(),
    label: raw.clashName ?? 'Unknown clash',
    severity: null,
    testName: testName ?? undefined,
    description: meta.description,
    status: meta.status,
    distance: meta.distance,
    clashPoint: meta.clashPoint,
    objects: raw.objects.map((obj) => ({
      revitGlobalId: obj.revitGlobalId,
      elementId: obj.elementId,
      itemName: obj.clashMetadata.itemName,
      itemType: obj.clashMetadata.itemType,
    })),
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [clashes, setClashes] = useState<Clash[]>([])
  const [navisworksFileName, setNavisworksFileName] = useState<string | null>(
    null,
  )
  const [speckleUrlRows, setSpeckleUrlRows] = useState<SpeckleUrlRow[]>([])
  const speckleUrls = useMemo(
    () => speckleUrlRows.map((r) => r.url),
    [speckleUrlRows],
  )
  const [severityThreshold, setSeverityThreshold] =
    useState<ClashSeverity>('LOW')
  const [selectedClashId, setSelectedClashIdState] = useState<string | null>(
    null,
  )
  const [clashObjectViewerFocus, setClashObjectViewerFocus] =
    useState<ClashObjectViewerFocusRequest | null>(null)

  const setSelectedClashId = useCallback((id: string | null) => {
    setClashObjectViewerFocus(null)
    setSelectedClashIdState(id)
  }, [])

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  )
  const [uploadError, setUploadError] = useState<string | null>(null)

  const navisworksFileRef = useRef<File | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const snap = await fetchClashSession()
        if (cancelled || !snap.has_session) return
        if (navisworksFileRef.current) return

        setSpeckleUrlRows(
          snap.speckle_urls.map((url) => ({
            id: crypto.randomUUID(),
            url,
          })),
        )

        if (snap.navisworks_file_name) {
          setNavisworksFileName(snap.navisworks_file_name)
        }

        if (!snap.parsed) {
          return
        }

        const next: Clash[] = []
        for (const test of snap.parsed.tests) {
          const testLabel = test.testName ?? undefined
          for (const raw of test.clashes) {
            const clash = mapBackendClash(raw, testLabel)
            const inf = snap.inference_by_clash_guid[clash.id]
            if (inf) {
              next.push({
                ...clash,
                severity: normalizeClashSeverity(inf.severity),
                disciplines: inf.disciplines ?? clash.disciplines,
                lead: inf.lead ?? clash.lead,
              })
            } else {
              next.push(clash)
            }
          }
        }
        setClashes(next)
        setUploadProgress(
          next.length > 0
            ? {
                completed: snap.inference_complete ? next.length : 0,
                total: next.length,
              }
            : null,
        )
        if (next.length > 0) {
          setSeverityThreshold('LOW')
          setSelectedClashId(next[0].id)
        }
      } catch {
        /* offline or API down — keep empty local state */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [setSelectedClashId])

  const setNavisworksReport = useCallback((file: File | null) => {
    navisworksFileRef.current = file
    if (!file) {
      setNavisworksFileName(null)
      setClashes([])
      setSelectedClashId(null)
      return
    }
    setNavisworksFileName(file.name)
    setClashes([])
    setSelectedClashId(null)
  }, [setSelectedClashId])

  const startClashUpload = useCallback(() => {
    const file = navisworksFileRef.current
    if (!file) return

    uploadAbortRef.current?.abort()
    const controller = new AbortController()
    uploadAbortRef.current = controller

    setIsUploading(true)
    setUploadProgress(null)
    setUploadError(null)
    setClashes([])

    uploadClashReport(
      file,
      {
        onParsed: (payload) => {
          const next: Clash[] = []
          for (const test of payload.tests) {
            const testLabel = test.testName ?? undefined
            for (const raw of test.clashes) {
              next.push(mapBackendClash(raw, testLabel))
            }
          }
          setClashes(next)
          setUploadProgress({ completed: 0, total: next.length })
          if (next.length > 0) {
            setSeverityThreshold('LOW')
            setSelectedClashId(next[0].id)
          }
        },
        onBatchResult: ({ results, completed, total }) => {
          const byGuid = new Map<string, ClashInferenceResult>()
          for (const row of results) {
            const guid = row.clash
            if (guid?.trim()) byGuid.set(guid.trim().toLowerCase(), row)
          }
          setClashes((prev) =>
            prev.map((clash) => {
              const inf = byGuid.get(clash.id.toLowerCase())
              if (!inf) return clash
              return {
                ...clash,
                severity: normalizeClashSeverity(inf.severity),
                disciplines: inf.disciplines ?? clash.disciplines,
                lead: inf.lead ?? clash.lead,
              }
            }),
          )
          setUploadProgress({ completed, total })
        },
        onDone: () => {
          setIsUploading(false)
        },
        onError: (detail) => {
          setIsUploading(false)
          setUploadError(detail)
        },
      },
      { signal: controller.signal },
    ).catch((err: unknown) => {
      if (controller.signal.aborted) return
      setIsUploading(false)
      setUploadError(err instanceof Error ? err.message : String(err))
    })
  }, [setSelectedClashId])

  const appendSpeckleUrlRow = useCallback(() => {
    setSpeckleUrlRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), url: '' },
    ])
  }, [])

  const setSpeckleUrlAt = useCallback((index: number, url: string) => {
    setSpeckleUrlRows((prev) => {
      if (index < 0 || index >= prev.length) return prev
      const next = [...prev]
      next[index] = { ...next[index], url }
      return next
    })
  }, [])

  const removeSpeckleUrlAt = useCallback((index: number) => {
    setSpeckleUrlRows((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const requestClashObjectViewerFocus = useCallback((matchKeys: string[]) => {
    const keys = matchKeys.map((k) => k.trim()).filter((k) => k.length > 0)
    if (keys.length === 0) {
      setClashObjectViewerFocus(null)
      return
    }
    setClashObjectViewerFocus((prev) => ({
      id: (prev?.id ?? 0) + 1,
      matchKeys: keys,
    }))
  }, [])

  const clearClashObjectViewerFocus = useCallback(() => {
    setClashObjectViewerFocus(null)
  }, [])

  const filteredClashes = useMemo(
    () =>
      clashes.filter((c) =>
        clashMatchesSeverityExactly(c.severity, severityThreshold),
      ),
    [clashes, severityThreshold],
  )

  const clearSession = useCallback(() => {
    uploadAbortRef.current?.abort()
    uploadAbortRef.current = null
    setClashes([])
    setNavisworksFileName(null)
    navisworksFileRef.current = null
    setSpeckleUrlRows([])
    setSeverityThreshold('LOW')
    setSelectedClashId(null)
    setClashObjectViewerFocus(null)
    setIsUploading(false)
    setUploadProgress(null)
    setUploadError(null)
    void deleteClashSession().catch(() => {
      /* best-effort */
    })
  }, [setSelectedClashId])

  const value = useMemo(
    () => ({
      clashes,
      navisworksFileName,
      setNavisworksReport,
      speckleUrls,
      speckleUrlRows,
      appendSpeckleUrlRow,
      setSpeckleUrlAt,
      removeSpeckleUrlAt,
      severityThreshold,
      setSeverityThreshold,
      selectedClashId,
      setSelectedClashId,
      filteredClashes,
      clearSession,
      isUploading,
      uploadProgress,
      uploadError,
      startClashUpload,
      clashObjectViewerFocus,
      requestClashObjectViewerFocus,
      clearClashObjectViewerFocus,
    }),
    [
      clashes,
      navisworksFileName,
      setNavisworksReport,
      speckleUrls,
      speckleUrlRows,
      appendSpeckleUrlRow,
      setSpeckleUrlAt,
      removeSpeckleUrlAt,
      severityThreshold,
      selectedClashId,
      setSelectedClashId,
      filteredClashes,
      clearSession,
      isUploading,
      uploadProgress,
      uploadError,
      startClashUpload,
      clashObjectViewerFocus,
      requestClashObjectViewerFocus,
      clearClashObjectViewerFocus,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
