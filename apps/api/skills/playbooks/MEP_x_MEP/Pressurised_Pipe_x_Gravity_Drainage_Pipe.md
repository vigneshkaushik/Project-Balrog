---
title: Pressurised Pipe × Gravity Drainage Pipe
category: MEP_x_MEP
elements: ["Pressurised Pipe", "Gravity Drainage Pipe"]
applies_when: Sloped drainage crosses pressurised MEP; pressurised trades yield to gravity.
severity_default: HIGH
---

## Anchor constraint

Gravity drainage always wins over pressurised pipes. Slope-dependent drainage cannot be relocated without affecting all upstream fixtures. Pressurised pipes (HVAC water, domestic, fire) yield without exception.

## Recommended resolutions (ranked)

### 1. Pressurised pipe offset around drainage

**Effort:** Low.

Insert a vertical or horizontal offset in the pressurised pipe to pass around the drainage pipe. For domestic water or HVAC pipes: straightforward 2 × 45° offset. For fire pipes (sprinkler, hose reel): offset must avoid air pockets in down-and-up configuration — specify air release valves (ARV) at any high point. Ensure pipe is re-supported within 300mm of each elbow.

**Checks:**

- [ ] If fire pipe: ARV specified at any high point in offset
- [ ] Pipe re-supported within 300mm of each elbow
- [ ] Check condensation risk if cold pressurised pipe is close to drainage pipe at crossing

### 2. Drain layout redesign (if slope deficit)

**Effort:** High. **VO risk:** Yes (formal variation / redesign likely).

If drainage cannot maintain slope due to accumulated elevation changes along its run, the drainage layout must be redesigned by the plumbing engineer. Common fix: raise invert level at source fixture, or introduce an additional stack drop point.

**Checks:**

- [ ] Plumbing engineer reviews entire drainage run for elevation deficit
- [ ] Architect confirms if raising fixture outlet levels is acceptable
- [ ] Revised run checked for new clashes

## Validate before acting

- [ ] Confirm drainage slope direction and invert levels at both ends of the run affected
- [ ] Confirm pressurised pipe material (copper, steel, HDPE) — affects minimum elbow radius for offset
- [ ] Check if drainage is under-slab or suspended — resolution options differ significantly

## Escalate immediately if

- Multiple pressurised pipes offset around same drainage run — indicates a zone coordination problem requiring a full section drawing

## Downstream risk if unresolved

Drainage routing should be established first on every floor plate before other MEP services are routed. If drainage was modelled last, expect many pressurised-pipe-vs-drainage clashes across the zone. Resolve drainage first as a batch, not one at a time.
