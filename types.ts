const urlType = {
  url: "url",
  ProductId: "ProductId",
  PackageFamilyName: "PackageFamilyName",
  CategoryId: "CategoryId",
} as const;

type UrlType = typeof urlType[keyof typeof urlType];

const Ring = {
  Fast: "Fast",
  Slow: "Slow",
  RP: "RP",
  Retail: "Retail",
} as const;

type Ring = typeof Ring[keyof typeof Ring];

export interface Body {
  type: UrlType;
  url: string;
  ring: Ring;
  [key: string]: string;
}

export interface PackageInfo {
  url: string;
  filename: string;
  checksum: string;
  version: string;
}
