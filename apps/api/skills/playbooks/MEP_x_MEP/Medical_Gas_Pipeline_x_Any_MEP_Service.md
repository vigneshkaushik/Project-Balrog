---
title: Medical Gas Pipeline × Any MEP Service
category: MEP_x_MEP
elements: ["Medical Gas Pipeline", "Any MEP Service"]
applies_when: Life-safety medical gas conflicts with another MEP route; regulatory and clearance rules are strict.
severity_default: CRITICAL
---

## Anchor constraint

Medical gas pipelines (O2, N2, compressed air, vacuum) are LIFE-SAFETY elements. They cannot be rerouted without written medical gas engineer approval and recertification of the modified section. All other MEP services yield without exception.

## Recommended resolutions (ranked)

### 1. Reroute non-medical MEP around the medical gas line

**Effort:** Medium.

Medical gas line position is fixed once installed. All other MEP services route around it. Minimum clearances: 150mm from electrical services, 100mm from other pipework, 300mm from sources of heat. Medical gas lines must never share a ceiling zone with electrical cable trays without a segregation screen. Medical gas lines must remain accessible for inspection at all times.

**Checks:**

- [ ] 150mm min clearance from electrical services confirmed
- [ ] 100mm min from other pipework confirmed
- [ ] Medical gas line remains accessible for inspection after installation of surrounding services
- [ ] No shared ceiling zone with cable trays without segregation screen

### 2. Medical gas reroute (only with engineer written approval)

**Effort:** High. **VO risk:** Yes (formal variation / redesign likely).

Only with written medical gas engineer approval. Rerouted sections require pressure testing and recertification to HTM 02-01 (UK) / NFPA 99 (US) / applicable standard. Reroute must maintain continuous pipe identification labels, meet minimum bend radii (copper or stainless with limited bending), and be documented in the as-built medical gas schematic.

**Checks:**

- [ ] Written medical gas engineer approval obtained first
- [ ] Pressure testing and recertification of modified section completed
- [ ] Updated as-built medical gas schematic issued to facilities and clinical engineering team

## Validate before acting

- [ ] Confirm gas type in pipeline (O2, vacuum, N2, medical air) — O2 proximity to flammables is the highest risk
- [ ] Confirm regulatory framework (HTM, NFPA 99, or local equivalent) governing this installation
- [ ] Check if pipeline has been commissioned — modification to a commissioned system requires full recommissioning

## Escalate immediately if

- Any proposed modification to an O2 pipeline — medical gas engineer and infection control team must be involved
- Clash discovered after medical gas commissioning — operational risk during any modification; clinical team must be informed

## Downstream risk if unresolved

Medical gas systems modified without recertification create patient safety risks and may violate the hospital operating licence. Any modification must be flagged to the facilities management and clinical engineering teams, not just the construction team.
