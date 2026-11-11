import type { AnatemaApi } from '@shared/types'
import { createMockApi } from '../mock'

const bridge = (window as unknown as { anatema?: AnatemaApi }).anatema
export const isPreview = !bridge
export const api: AnatemaApi = bridge ?? createMockApi()
