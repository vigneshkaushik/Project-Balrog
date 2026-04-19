import { Box3, Vector3 } from 'three'
import { CameraController, type TreeNode, type Viewer } from '@speckle/viewer'

export interface ZoomToSmallestClashObjectOptions {
  /** Animate camera (passed to Speckle `CameraController.setCameraView`). */
  transition?: boolean
  /**
   * Fit margin factor for `setCameraView` (Speckle defaults ~1.2 when omitted).
   */
  fit?: number
  /**
   * If set, bounding-box / zoom targets use these Speckle object ids only (skip
   * re-resolving from `clashObjectMatchKeys`).
   */
  resolvedObjectIds?: readonly string[]
}

export interface ResolvedClashObjectNodes {
  matchedNodes: TreeNode[]
  matchedObjectIds: string[]
  unmatchedElementIds: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const s = String(Math.trunc(value))
    return s.length > 0 ? s : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

/** Build lookup keys for clash-side ids (string + lowercase for GUID-like values). */
function expandMatchTargets(rawIds: readonly string[]): Set<string> {
  const set = new Set<string>()
  for (const raw of rawIds) {
    const n = normalizeId(raw)
    if (!n) continue
    set.add(n)
    if (n.includes('-') && n.length >= 32) set.add(n.toLowerCase())
  }
  return set
}

function scanObjectForIdentifierValues(
  obj: Record<string, unknown> | null | undefined,
  out: string[],
): void {
  if (!obj) return
  for (const [k, v] of Object.entries(obj)) {
    const key = k.toLowerCase()
    const relevant =
      key.includes('elementid') ||
      key === 'applicationid' ||
      key.includes('uniqueid') ||
      key.includes('globalid') ||
      key.includes('ifcguid')
    if (!relevant) continue
    const n = normalizeId(v)
    if (n) {
      out.push(n)
      if (n.includes('-') && n.length >= 32) out.push(n.toLowerCase())
    }
  }
}

/** Collect strings from a Speckle `raw` object that may correspond to Navis `elementId` / Revit ids. */
function collectIdentifierStringsFromRaw(raw: Record<string, unknown>): string[] {
  const out: string[] = []
  const pushFlat = (v: unknown) => {
    const n = normalizeId(v)
    if (n) {
      out.push(n)
      if (n.includes('-') && n.length >= 32) out.push(n.toLowerCase())
    }
  }
  pushFlat(raw.applicationId)
  pushFlat(raw.elementId)
  scanObjectForIdentifierValues(raw, out)
  if (isRecord(raw.properties)) scanObjectForIdentifierValues(raw.properties, out)
  if (isRecord(raw.parameters)) scanObjectForIdentifierValues(raw.parameters, out)
  const params = raw.parameters
  if (Array.isArray(params)) {
    for (const p of params) {
      if (!isRecord(p)) continue
      const name = typeof p.name === 'string' ? p.name.toLowerCase() : ''
      if (
        name.includes('element') ||
        name.includes('unique') ||
        name.includes('global')
      ) {
        pushFlat(p.value)
      }
    }
  }
  return out
}

function nodeMatchesTargets(node: TreeNode, targets: Set<string>): boolean {
  const raw = node.model.raw
  if (!isRecord(raw)) return false
  for (const s of collectIdentifierStringsFromRaw(raw)) {
    if (targets.has(s)) return true
  }
  return false
}

/**
 * Union AABBs from `RenderTree.getRenderViewsForNode` (same path Speckle uses for
 * filtering). Tree nodes from `findId` / property walks often have no
 * `model.renderView`; geometry lives on render views instead.
 */
function unionBoxFromRenderViewsForNode(
  viewer: Viewer,
  node: TreeNode,
): Box3 | null {
  const rvs = viewer.getWorldTree().getRenderTree().getRenderViewsForNode(node)
  if (!rvs?.length) return null

  const box = new Box3()
  let hasAny = false
  for (const rv of rvs) {
    const aabb = rv.aabb
    if (!aabb || aabb.isEmpty()) continue
    if (!hasAny) {
      box.copy(aabb)
      hasAny = true
    } else {
      box.union(aabb)
    }
  }
  return hasAny && !box.isEmpty() ? box : null
}

export function unionBoxForSpeckleObjectId(
  viewer: Viewer,
  objectId: string,
): Box3 | null {
  const found = viewer.getWorldTree().findId(objectId)
  if (!found?.length) return null

  const box = new Box3()
  let hasAny = false
  for (const n of found) {
    const part = unionBoxFromRenderViewsForNode(viewer, n)
    if (!part) continue
    if (!hasAny) {
      box.copy(part)
      hasAny = true
    } else {
      box.union(part)
    }
  }
  return hasAny && !box.isEmpty() ? box : null
}

/** Union world AABBs for all given Speckle object ids (clash participants). */
export function unionBoxesForSpeckleObjectIds(
  viewer: Viewer,
  objectIds: readonly string[],
): Box3 | null {
  const box = new Box3()
  let hasAny = false
  for (const id of objectIds) {
    const part = unionBoxForSpeckleObjectId(viewer, id)
    if (!part) continue
    if (!hasAny) {
      box.copy(part)
      hasAny = true
    } else {
      box.union(part)
    }
  }
  return hasAny && !box.isEmpty() ? box : null
}

/** Uses AABB volume (with a size-length fallback for degenerate boxes). */
function boxSizeMetric(box: Box3): number {
  const size = new Vector3()
  box.getSize(size)
  const vol = size.x * size.y * size.z
  if (vol > 1e-18) return vol
  return size.lengthSq()
}

export function resolveClashObjectNodes(
  viewer: Viewer,
  clashObjectMatchKeys: readonly string[],
): ResolvedClashObjectNodes {
  const targetIds = clashObjectMatchKeys
    .map((value) => normalizeId(value))
    .filter((value): value is string => value !== null)
  if (targetIds.length === 0) {
    return { matchedNodes: [], matchedObjectIds: [], unmatchedElementIds: [] }
  }

  const tree = viewer.getWorldTree()
  const targetSet = expandMatchTargets(targetIds)
  const matchedNodes = new Set<TreeNode>()
  const matchedKeys = new Set<string>()

  for (const id of targetSet) {
    const directMatches = tree.findId(id) ?? []
    if (directMatches.length > 0) {
      matchedKeys.add(id)
      for (const node of directMatches) matchedNodes.add(node)
    }
  }

  tree.walk((node) => {
    if (!nodeMatchesTargets(node, targetSet)) return true
    const raw = node.model.raw
    if (isRecord(raw)) {
      for (const s of collectIdentifierStringsFromRaw(raw)) {
        if (targetSet.has(s)) matchedKeys.add(s)
      }
    }
    matchedNodes.add(node)
    return true
  })

  const nodeList = Array.from(matchedNodes)
  const objectIds = Array.from(
    new Set(
      nodeList
        .map((node) => node.model?.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  )

  return {
    matchedNodes: nodeList,
    matchedObjectIds: objectIds,
    unmatchedElementIds: targetIds.filter((id) => {
      const expanded = expandMatchTargets([id])
      for (const k of expanded) {
        if (matchedKeys.has(k)) return false
      }
      return true
    }),
  }
}

/**
 * Speckle ids for every node in the subtrees rooted at clash-matched nodes
 * (including `nestedNodes`). Meshes often sit on descendants with different ids
 * than the Revit host row matched by Navis elementId, so excluding only
 * `matchedObjectIds` leaves sibling geometry in “context”.
 */
export function expandMatchedClashSubtreeSpeckleIds(
  matchedNodes: readonly TreeNode[],
): Set<string> {
  const out = new Set<string>()

  const addClashSubtreeSpeckleIds = (node: TreeNode, ids: Set<string>): void => {
    node.walk((visiting: TreeNode) => {
      const m = visiting.model
      if (m) {
        const id = m.id
        if (typeof id === 'string' && id.trim().length > 0) {
          ids.add(id)
        }
        const nested = m.nestedNodes
        if (nested && nested.length > 0) {
          for (const subRoot of nested) {
            if (subRoot) addClashSubtreeSpeckleIds(subRoot, ids)
          }
        }
      }
      return true
    })
  }

  for (const root of matchedNodes) {
    addClashSubtreeSpeckleIds(root, out)
  }
  return out
}

/** Convenience: resolve clash keys then return ids to omit from context/nearby. */
export function clashParticipantSpeckleIdsForContextExclusion(
  viewer: Viewer,
  clashObjectMatchKeys: readonly string[],
): Set<string> {
  return expandMatchedClashSubtreeSpeckleIds(
    resolveClashObjectNodes(viewer, clashObjectMatchKeys).matchedNodes,
  )
}

/**
 * Frames the Speckle viewer on the clash object with the smallest world-space
 * axis-aligned bounding box among the nodes resolved from clash `elementId`s.
 *
 * Resolution first attempts `WorldTree.findId(elementId)` and then falls back to
 * checking common Speckle / Revit fields on `node.model.raw` (including numeric
 * `elementId` and nested `properties` / `parameters`).
 *
 * @returns The viewer object id that was framed, or `null` if none resolved.
 */
export function zoomViewerToSmallestClashObject(
  viewer: Viewer,
  clashObjectMatchKeys: readonly string[],
  options: ZoomToSmallestClashObjectOptions = {},
): string | null {
  if (!viewer.hasExtension(CameraController)) {
    console.warn(
      '[zoomViewerToSmallestClashObject] CameraController extension is missing',
    )
    return null
  }

  const transition = options.transition ?? true
  const fit = options.fit ?? 1.25

  const objectIds =
    options.resolvedObjectIds && options.resolvedObjectIds.length > 0
      ? [...new Set(options.resolvedObjectIds.filter((id) => id.trim().length > 0))]
      : resolveClashObjectNodes(viewer, clashObjectMatchKeys).matchedObjectIds

  if (objectIds.length === 0) return null

  let bestId: string | null = null
  let bestBox: Box3 | null = null
  let bestMetric = Number.POSITIVE_INFINITY

  for (const objectId of objectIds) {
    const box = unionBoxForSpeckleObjectId(viewer, objectId)
    if (!box) continue
    const m = boxSizeMetric(box)
    if (m < bestMetric) {
      bestMetric = m
      bestId = objectId
      bestBox = box
    }
  }

  const camera = viewer.getExtension(CameraController)
  if (!camera) {
    console.warn(
      '[zoomViewerToSmallestClashObject] CameraController extension missing at zoom time',
    )
    return null
  }

  try {
    if (bestId !== null) {
      camera.setCameraView([bestId], transition, fit)
    } else if (bestBox) {
      camera.setCameraView(bestBox, transition, fit)
    } else if (objectIds.length > 0) {
      camera.setCameraView(objectIds, transition, fit)
    } else {
      return null
    }
  } catch (e) {
    console.warn('[zoomViewerToSmallestClashObject] setCameraView failed', e)
    if (bestBox) {
      try {
        camera.setCameraView(bestBox, transition, fit)
      } catch (e2) {
        console.warn(
          '[zoomViewerToSmallestClashObject] setCameraView(box) fallback failed',
          e2,
        )
        return null
      }
    } else {
      return null
    }
  }
  viewer.requestRender()

  return bestId
}
