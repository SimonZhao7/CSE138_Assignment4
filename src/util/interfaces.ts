export interface IKeyValuePairs {
  [key: string]: string
}

export interface IVectorClock {
  [key: string]: number
}

export interface IResetDataJson {
  views?: string[],
  store?: IKeyValuePairs,
  'causal-metadata': IVectorClock
}

export interface IShardMemberMap {
  [key: number]: string[];
}