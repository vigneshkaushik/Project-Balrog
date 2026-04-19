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

const OBJECT_METADATA_STORAGE_KEY = 'balrog-object-metadata'

function readInitialObjectMetadata(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(OBJECT_METADATA_STORAGE_KEY)
    if (raw == null) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string' && k.trim()) out[k] = v
    }
    return out
  } catch {
    return {}
  }
}

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
      layer: obj.clashMetadata.layer ?? null,
      rawAttributes: obj.rawAttributes,
      rawSmartTags: obj.rawSmartTags,
    })),
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isSessionHydrating, setIsSessionHydrating] = useState(true)
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
  const [highlightFilteredSeverity, setHighlightFilteredSeverityState] =
    useState(false)
  const [selectedClashId, setSelectedClashIdState] = useState<string | null>(
    null,
  )
  const [clashObjectViewerFocus, setClashObjectViewerFocus] =
    useState<ClashObjectViewerFocusRequest | null>(null)
  const [objectMetadata, setObjectMetadataState] = useState<
    Record<string, string>
  >(readInitialObjectMetadata)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        OBJECT_METADATA_STORAGE_KEY,
        JSON.stringify(objectMetadata),
      )
    } catch {
      /* quota / private mode */
    }
  }, [objectMetadata])

  const setObjectMetadata = useCallback((speckleId: string, text: string) => {
    const id = speckleId.trim()
    if (!id) return
    const trimmed = text.trim()
    setObjectMetadataState((prev) => {
      if (!trimmed) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      if (prev[id] === trimmed) return prev
      return { ...prev, [id]: trimmed }
    })
  }, [])

  const clearObjectMetadata = useCallback((speckleId: string) => {
    const id = speckleId.trim()
    if (!id) return
    setObjectMetadataState((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const setSelectedClashId = useCallback((id: string | null) => {
    setClashObjectViewerFocus(null)
    if (id) {
      setHighlightFilteredSeverityState(false)
    }
    setSelectedClashIdState(id)
  }, [])

  const setHighlightFilteredSeverity = useCallback((next: boolean) => {
    setHighlightFilteredSeverityState(next)
    if (next) {
      setSelectedClashIdState(null)
      setClashObjectViewerFocus(null)
    }
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
          setSelectedClashId(null)
        }
      } catch {
        /* offline or API down — keep empty local state */
      } finally {
        if (!cancelled) {
          setIsSessionHydrating(false)
        }
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
            setSelectedClashId(null)
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
    setHighlightFilteredSeverityState(false)
    setSelectedClashId(null)
    setClashObjectViewerFocus(null)
    setIsUploading(false)
    setUploadProgress(null)
    setUploadError(null)
    setObjectMetadataState({})
    try {
      window.localStorage.removeItem(OBJECT_METADATA_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    void deleteClashSession().catch(() => {
      /* best-effort */
    })
  }, [setSelectedClashId])

  const value = useMemo(
    () => ({
      isSessionHydrating,
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
      highlightFilteredSeverity,
      setHighlightFilteredSeverity,
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
      objectMetadata,
      setObjectMetadata,
      clearObjectMetadata,
    }),
    [
      isSessionHydrating,
      clashes,
      navisworksFileName,
      setNavisworksReport,
      speckleUrls,
      speckleUrlRows,
      appendSpeckleUrlRow,
      setSpeckleUrlAt,
      removeSpeckleUrlAt,
      severityThreshold,
      highlightFilteredSeverity,
      setHighlightFilteredSeverity,
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
      objectMetadata,
      setObjectMetadata,
      clearObjectMetadata,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
