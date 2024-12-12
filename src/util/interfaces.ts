export interface IKeyValuePairs {
  [key: string]: any
}

export interface IVectorClock {
  [key: string]: number
}

export interface IResetDataJson {
  views?: string[],
  shardIds?: number[],
  shardMemberMap?: IShardMemberMap,
  store?: IKeyValuePairs,
  'causal-metadata': IVectorClock,
  shardId?: number,
}

export interface IShardMemberMap {
  [key: number]: string[];
}