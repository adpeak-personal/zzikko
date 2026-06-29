export interface GenerateBlogTitlesInput {
  min: number;
  max: number;
}

export interface GenerateBlogTitlesResponse {
  titles: string[];
  meta: {
    regions: number;
    models: number;
    requested_min: number;
    requested_max: number;
    got: number;
  };
}
