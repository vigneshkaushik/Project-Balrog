import { Box3, Vector3 } from 'three'
import {
  CameraController,
  type TreeNode,
  type Viewer,
} from '@speckle/viewer'

export interface ZoomToSmallestClashObjectOptions {
  /** Animate camera (passed to Speckle `CameraController.setCameraView`). */
  transition?: boolean
  /** Fit margin factor for `setCameraView` (Speckle default applies when omitted). */
  fit?: number
}

function walkSpeckleSubtree(node: TreeNode, visit: (n: TreeNode) => void): void {
  visit(node)
  const data = node.model
  const nested = data.nestedNodes
  if (nested) {
    for (const n of nested) {
      walkSpeckleSubtree(n, visit)
    }
  }
  for (const child of node.children as TreeNode[]) {
    walkSpeckleSubtree(child, visit)
  }
}

function unionBoundingBoxForApplicationId(
  rootNodes: TreeNode[],
): Box3 | null {
  const box = new Box3()
  let hasAny = false

  for (const root of rootNodes) {
    walkSpeckleSubtree(root, (n) => {
      const rv = n.model.renderView
      if (!rv) return
      const aabb = rv.aabb
      if (aabb.isEmpty()) return
      if (!hasAny) {
        box.copy(aabb)
        hasAny = true
      } else {
        box.union(aabb)
      }
    })
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

/**
 * Frames the Speckle viewer on the clash object with the smallest world-space
 * axis-aligned bounding box among the given application / object ids.
 *
 * Ids are resolved with `WorldTree.findId` (same ids used by
 * `SelectionExtension.selectObjects`).
 *
 * @returns The application id that was framed, or `null` if none resolved.
 */
export function zoomViewerToSmallestClashObject(
  viewer: Viewer,
  clashObjectApplicationIds: readonly string[],
  options: ZoomToSmallestClashObjectOptions = {},
): string | null {
  const ids = clashObjectApplicationIds
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (ids.length === 0) return null

  if (!viewer.hasExtension(CameraController)) {
    console.warn(
      '[zoomViewerToSmallestClashObject] CameraController extension is missing',
    )
    return null
  }

  const tree = viewer.getWorldTree()
  const transition = options.transition ?? true
  const fit = options.fit

  let bestId: string | null = null
  let bestBox: Box3 | null = null
  let bestMetric = Number.POSITIVE_INFINITY

  for (const id of ids) {
    const found = tree.findId(id)
    if (!found?.length) continue
    const box = unionBoundingBoxForApplicationId(found)
    if (!box) continue
    const m = boxSizeMetric(box)
    if (m < bestMetric) {
      bestMetric = m
      bestId = id
      bestBox = box
    }
  }

  if (!bestBox || bestId === null) return null

  const camera = viewer.getExtension(CameraController)
  camera.setCameraView(bestBox, transition, fit)
  viewer.requestRender()

  return bestId
}
