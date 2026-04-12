import type { DataRecord, PlatformStatus } from './schema'

export interface PingResponse {
  message: string
  timestamp: number
}

export interface GetRecordsInput {
  limit?: number
  offset?: number
  platform?: string
  category?: string
}

export interface GetRecordsResponse {
  records: DataRecord[]
  total: number
}

export interface GetStatusResponse {
  statuses: PlatformStatus[]
}
