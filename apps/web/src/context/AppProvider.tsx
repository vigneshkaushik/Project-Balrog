import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Clash, ClashSeverity } from '../types'
import { clashMeetsMinimumSeverity, normalizeClashSeverity } from '../types'
import { uploadClashReport } from '../lib/uploadClashReport'
import {
  AppContext,
  type SpeckleUrlRow,
  type UploadProgress,
} from './appStateContext'

function mapBackendClash(
  raw: Record<string, unknown>,
  testName?: string,
): Clash {
  const meta = (raw.clashMetadata ?? {}) as Record<string, unknown>
  const objects = Array.isArray(raw.objects) ? raw.objects : []

  const guidRaw = raw.clashGuid as string | undefined
  return {
    id: guidRaw?.trim()
      ? guidRaw.trim().toLowerCase()
      : crypto.randomUUID(),
    label: (raw.clashName as string) ?? 'Unknown clash',
    severity: normalizeClashSeverity(raw.severity),
    disciplines: raw.disciplines as string[] | undefined,
    lead: raw.lead as string[] | undefined,
    testName,
    description: (meta.description as string) ?? null,
    status: (meta.status as string) ?? null,
    distance: (meta.distance as number) ?? null,
    clashPoint: (meta.clashPoint as Clash['clashPoint']) ?? null,
    objects: objects.map((obj: Record<string, unknown>) => {
      const objMeta = (obj.clashMetadata ?? {}) as Record<string, unknown>
      return {
        revitGlobalId: (obj.revitGlobalId as string) ?? null,
        elementId: (obj.elementId as string) ?? null,
        itemName: (objMeta.itemName as string) ?? null,
        itemType: (objMeta.itemType as string) ?? null,
      }
    }),
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
  const [selectedClashId, setSelectedClashId] = useState<string | null>(null)

  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null,
  )
  const [uploadError, setUploadError] = useState<string | null>(null)

  const navisworksFileRef = useRef<File | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)

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
  }, [])

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
          const tests = (
            payload as { tests?: { testName?: string; clashes?: Record<string, unknown>[] }[] }
          ).tests ?? []
          const next: Clash[] = []
          for (const test of tests) {
            for (const raw of test.clashes ?? []) {
              next.push(mapBackendClash(raw, test.testName))
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
          const byGuid = new Map<string, Record<string, unknown>>()
          for (const row of results) {
            const guid = row.clash as string | undefined
            if (guid?.trim()) byGuid.set(guid.trim().toLowerCase(), row)
          }
          setClashes((prev) =>
            prev.map((clash) => {
              const inf = byGuid.get(clash.id.toLowerCase())
              if (!inf) return clash
              return {
                ...clash,
                severity: normalizeClashSeverity(inf.severity),
                disciplines: (inf.disciplines as string[]) ?? clash.disciplines,
                lead: (inf.lead as string[]) ?? clash.lead,
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
  }, [])

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

  const filteredClashes = useMemo(
    () =>
      clashes.filter((c) =>
        clashMeetsMinimumSeverity(c.severity, severityThreshold),
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
    setIsUploading(false)
    setUploadProgress(null)
    setUploadError(null)
  }, [])

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
      filteredClashes,
      clearSession,
      isUploading,
      uploadProgress,
      uploadError,
      startClashUpload,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
